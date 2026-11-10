import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ServeStaticModule } from '@nestjs/serve-static';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PLATFORM } from '@mehfil/shared';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['log', 'warn', 'error'],
  });
  const config = app.get(ConfigService);
  const reflector = app.get(Reflector);

  const apiPrefix = config.get<string>('app.apiPrefix') || 'api';
  app.setGlobalPrefix(apiPrefix, { exclude: ['health'] });
  app.set('trust proxy', 1);

  // Security & parsing middleware.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
    }),
  );
  app.use(compression());
  app.use(cookieParser());

  // CORS for web + mobile clients.
  const origins = config.get<string[]>('app.corsOrigins') || [];
  app.enableCors({
    origin: origins.length ? origins : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  });

  // Global validation: whitelist unknown props, transform types, forbid non-whitelisted.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidNonWhitelisted: false,
    }),
  );

  // Global guards & exception filter.
  app.useGlobalGuards(new JwtAuthGuard(reflector), new RolesGuard(reflector));
  app.useGlobalFilters(new AllExceptionsFilter());

  app.enableShutdownHooks();

  // Swagger API docs (available in all envs; protect in prod via reverse proxy).
  const swaggerConfig = new DocumentBuilder()
    .setTitle(`${PLATFORM.name} API`)
    .setDescription('Community + Ticketing platform API — Phase 1 (MVP)')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = config.get<number>('app.port') || 4000;
  await app.listen(port, '0.0.0.0');
  Logger.log(
    `${PLATFORM.name} API running at http://localhost:${port}/${apiPrefix} — docs at /docs`,
    'Bootstrap',
  );
}

// Reference ServeStaticModule so the upload dir is served (configured in app.module).
void ServeStaticModule;

bootstrap();
