import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { EventRsvpStatus } from '@mehfil/shared';
import { CurrentUser, Public } from '../common/decorators';
import { AuthUser } from '../common/types/auth-user.type';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { EventsService } from './events.service';
import {
  CreateEventDto,
  UpdateEventDto,
  EventQueryDto,
  RsvpDto,
  TicketTierDto,
} from './dto/event.dto';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Post()
  @ApiOperation({ summary: 'Create an event (draft)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEventDto) {
    return this.events.createEvent(user.id, dto);
  }

  @Get('discover')
  @Public()
  @ApiOperation({ summary: 'Discover / search events' })
  discover(
    @CurrentUser() user: AuthUser | undefined,
    @Query() query: EventQueryDto,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.events.discover(user?.id, query, pagination.page, pagination.limit);
  }

  @Get('mine')
  @ApiOperation({ summary: 'Events I organize' })
  mine(@CurrentUser() user: AuthUser, @Query() pagination: PaginationQueryDto) {
    return this.events.myEvents(user.id, pagination.page, pagination.limit);
  }

  @Get('attending')
  @ApiOperation({ summary: 'Events I am attending' })
  attending(@CurrentUser() user: AuthUser, @Query() pagination: PaginationQueryDto) {
    return this.events.attendingEvents(user.id, pagination.page, pagination.limit);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get event details by id or slug' })
  getOne(@Param('id') id: string, @CurrentUser() user: AuthUser | undefined) {
    return this.events.getEvent(user?.id, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an event (organizer/staff)' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
  ) {
    return this.events.updateEvent(user.id, user.role, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an event (organizer/staff)' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.events.deleteEvent(user.id, user.role, id);
  }

  @Post(':id/rsvp')
  @ApiOperation({ summary: 'RSVP to an event' })
  rsvp(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RsvpDto) {
    return this.events.setRsvp(user.id, id, dto.status as EventRsvpStatus);
  }

  @Get(':id/attendees')
  @ApiOperation({ summary: 'List attendees (organizer/staff)' })
  attendees(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.events.listAttendees(user.id, user.role, id, pagination.page, pagination.limit);
  }

  // ------------------------------ Ticket tiers -----------------------------

  @Post(':id/tiers')
  @ApiOperation({ summary: 'Add a ticket tier (organizer/staff)' })
  addTier(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: TicketTierDto) {
    return this.events.addTier(user.id, user.role, id, dto);
  }

  @Put(':id/tiers/:tierId')
  @ApiOperation({ summary: 'Update a ticket tier (organizer/staff)' })
  updateTier(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('tierId') tierId: string,
    @Body() dto: TicketTierDto,
  ) {
    return this.events.updateTier(user.id, user.role, id, tierId, dto);
  }

  @Delete(':id/tiers/:tierId')
  @ApiOperation({ summary: 'Delete a ticket tier (organizer/staff)' })
  deleteTier(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('tierId') tierId: string,
  ) {
    return this.events.deleteTier(user.id, user.role, id, tierId);
  }
}
