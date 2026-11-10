import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SOCKET_EVENTS } from '@mehfil/shared';
import { CurrentUser } from '../common/decorators';
import { AuthUser } from '../common/types/auth-user.type';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { MessagesService } from './messages.service';
import { StartConversationDto, SendMessageDto } from './dto/message.dto';

@ApiTags('messages')
@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly messages: MessagesService,
    private readonly realtime: RealtimeGateway,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Start a direct or group conversation' })
  start(@CurrentUser() user: AuthUser, @Body() dto: StartConversationDto) {
    return this.messages.startConversation(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List my conversations (inbox)' })
  list(@CurrentUser() user: AuthUser, @Query() pagination: PaginationQueryDto) {
    return this.messages.listConversations(user.id, pagination.page, pagination.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a conversation with participants + last message' })
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.messages.getConversation(user.id, id);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'List messages in a conversation' })
  messagesList(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.messages.getMessages(user.id, id, pagination.page, pagination.limit ?? 50);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Send a message (REST fallback; realtime preferred)' })
  async send(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    const result = await this.messages.sendMessage(user.id, { ...dto, conversationId: id });
    for (const pid of result.participantIds) {
      this.realtime.emitToUser(pid, SOCKET_EVENTS.MESSAGE_NEW, {
        conversationId: result.conversationId,
        message: result.message,
      });
    }
    return result.message;
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark a conversation as read' })
  async read(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const res = await this.messages.markRead(user.id, id);
    const participants = await this.messages.getParticipantIds(id);
    for (const pid of participants) {
      if (pid !== user.id) this.realtime.emitToUser(pid, SOCKET_EVENTS.MESSAGE_READ, res);
    }
    return res;
  }
}

@ApiTags('messages')
@Controller('messages')
export class MessagesController {
  constructor(
    private readonly messages: MessagesService,
    private readonly realtime: RealtimeGateway,
  ) {}

  @Delete(':id')
  @ApiOperation({ summary: 'Delete (unsend) my message' })
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const res = await this.messages.deleteMessage(user.id, id);
    const participants = await this.messages.getParticipantIds(res.conversationId);
    for (const pid of participants) {
      this.realtime.emitToUser(pid, SOCKET_EVENTS.MESSAGE_DELETED, res);
    }
    return { success: true };
  }
}
