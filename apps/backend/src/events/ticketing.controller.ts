import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CheckInMethod } from '@prisma/client';
import { CurrentUser } from '../common/decorators';
import { AuthUser } from '../common/types/auth-user.type';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { TicketingService } from './ticketing.service';
import { CheckoutDto, CheckInDto, RefundRequestDto, NoteDto } from './dto/event.dto';

/** Event-scoped ticketing routes (checkout, check-in, organizer sales). */
@ApiTags('ticketing')
@Controller('events')
export class EventTicketingController {
  constructor(private readonly ticketing: TicketingService) {}

  @Post(':id/checkout')
  @ApiOperation({ summary: 'Checkout — create an order and reserve tickets' })
  checkout(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CheckoutDto) {
    return this.ticketing.checkout(user.id, id, dto);
  }

  @Post(':id/checkin')
  @ApiOperation({ summary: 'Check in an attendee by ticket code/QR (organizer/staff)' })
  checkIn(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CheckInDto,
    @Query('method') method?: string,
  ) {
    const m = (method?.toUpperCase() as CheckInMethod) || CheckInMethod.QR;
    return this.ticketing.checkIn(user.id, user.role, id, dto.code, m);
  }

  @Get(':id/sales')
  @ApiOperation({ summary: 'Sales summary for an event (organizer/staff)' })
  sales(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ticketing.eventSalesSummary(user.id, user.role, id);
  }

  @Get(':id/orders')
  @ApiOperation({ summary: 'Orders for an event (organizer/staff)' })
  orders(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.ticketing.getEventOrders(user.id, user.role, id, pagination.page, pagination.limit);
  }

  @Get(':id/tickets')
  @ApiOperation({ summary: 'All tickets for an event (organizer/staff)' })
  tickets(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.ticketing.getEventTickets(user.id, user.role, id, pagination.page, pagination.limit);
  }
}

/** Buyer-facing order routes. */
@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ticketing: TicketingService) {}

  @Get('mine')
  @ApiOperation({ summary: 'My orders' })
  mine(@CurrentUser() user: AuthUser, @Query() pagination: PaginationQueryDto) {
    return this.ticketing.getMyOrders(user.id, pagination.page, pagination.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an order (buyer/organizer/staff)' })
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ticketing.getOrder(user.id, user.role, id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel an unpaid order (buyer)' })
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ticketing.cancelOrder(user.id, id);
  }

  @Post(':id/refund')
  @ApiOperation({ summary: 'Request a refund (buyer)' })
  requestRefund(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RefundRequestDto,
  ) {
    return this.ticketing.requestRefund(user.id, id, dto.reason);
  }

  @Post(':id/refund/approve')
  @ApiOperation({ summary: 'Approve + process a refund (organizer/staff)' })
  approveRefund(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ticketing.processRefund(user.id, user.role, id, true);
  }

  @Post(':id/refund/reject')
  @ApiOperation({ summary: 'Reject a refund (organizer/staff)' })
  rejectRefund(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ticketing.processRefund(user.id, user.role, id, false);
  }

  @Post(':id/approve-payment')
  @ApiOperation({ summary: 'Approve a manual payment (organizer/staff)' })
  approvePayment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: NoteDto,
  ) {
    return this.ticketing.approvePayment(user.id, user.role, id, dto.note);
  }

  @Post(':id/reject-payment')
  @ApiOperation({ summary: 'Reject a manual payment (organizer/staff)' })
  rejectPayment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: NoteDto,
  ) {
    return this.ticketing.rejectPayment(user.id, user.role, id, dto.note);
  }
}

/** Buyer-facing ticket wallet routes. */
@ApiTags('tickets')
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketing: TicketingService) {}

  @Get('mine')
  @ApiOperation({ summary: 'My ticket wallet' })
  mine(@CurrentUser() user: AuthUser, @Query() pagination: PaginationQueryDto) {
    return this.ticketing.getMyTickets(user.id, pagination.page, pagination.limit);
  }

  @Get(':id/qr')
  @ApiOperation({ summary: 'Get the QR code (data URL) for one of my tickets' })
  qr(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ticketing.getTicketQr(user.id, user.role, id);
  }
}
