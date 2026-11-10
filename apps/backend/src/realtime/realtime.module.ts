import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RealtimeGateway } from './realtime.gateway';
import { MessagesModule } from '../messages/messages.module';

/**
 * Global realtime module — exposes RealtimeGateway so any service can push
 * events (chat messages, notifications, live counters) to connected sockets.
 * It imports MessagesModule so the gateway can persist + broadcast chat.
 * MessagesModule has no dependency back on this module (the gateway is global),
 * so there is no circular import.
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('app.jwt.accessSecret'),
        signOptions: { expiresIn: config.get<string>('app.jwt.accessExpiresIn') },
      }),
    }),
    MessagesModule,
  ],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
