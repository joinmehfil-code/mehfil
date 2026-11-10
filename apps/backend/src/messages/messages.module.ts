import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { ConversationsController, MessagesController } from './messages.controller';

/**
 * MessagesModule — chat persistence + REST endpoints.
 * Realtime delivery lives in the global RealtimeGateway (which imports this
 * module to access MessagesService). This module relies on the global gateway,
 * so there is no circular module import.
 */
@Module({
  controllers: [ConversationsController, MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
