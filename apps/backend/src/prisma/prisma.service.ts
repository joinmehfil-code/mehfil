import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaService — single PrismaClient instance shared across the app.
 * Connects on module init and disconnects on shutdown.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? ['warn', 'error']
          : ['error'],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected to PostgreSQL');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Prisma disconnected');
  }

  /** Convenience: clean all data (used by tests/seeds). */
  async cleanDatabase(): Promise<void> {
    if (process.env.NODE_ENV !== 'test') return;
    // Order matters due to FK constraints; truncate cascade handles it.
    await this.$executeRaw`TRUNCATE TABLE "User" RESTART IDENTITY CASCADE`;
  }
}
