import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ScheduleModule } from '@nestjs/schedule';
import { resolve } from 'path';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { HealthModule } from './health/health.module';
import { MediaModule } from './media/media.module';
import { RealtimeModule } from './realtime/realtime.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PostsModule } from './posts/posts.module';
import { CommunitiesModule } from './communities/communities.module';
import { EventsModule } from './events/events.module';
import { MessagesModule } from './messages/messages.module';
import { ReportsModule } from './reports/reports.module';
import { AdminModule } from './admin/admin.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env', '.env.local'],
    }),
    ScheduleModule.forRoot(),
    ServeStaticModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const dir = config.get<string>('app.upload.dir') || 'uploads';
        // resolve() (not join) so an absolute UPLOAD_DIR like /data/uploads
        // (a mounted persistent volume in production) is honored as-is.
        const rootPath = resolve(process.cwd(), dir);
        return [
          {
            rootPath,
            serveRoot: '/uploads',
            serveStaticOptions: { index: false, fallthrough: true },
          },
        ];
      },
    }),
    PrismaModule,
    MailModule,
    RealtimeModule,
    AuthModule,
    UsersModule,
    MediaModule,
    NotificationsModule,
    PostsModule,
    CommunitiesModule,
    EventsModule,
    MessagesModule,
    ReportsModule,
    AdminModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
