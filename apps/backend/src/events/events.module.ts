import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { TicketingService } from './ticketing.service';
import { EventsController } from './events.controller';
import {
  EventTicketingController,
  OrdersController,
  TicketsController,
} from './ticketing.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [EventsController, EventTicketingController, OrdersController, TicketsController],
  providers: [EventsService, TicketingService],
  exports: [EventsService, TicketingService],
})
export class EventsModule {}
