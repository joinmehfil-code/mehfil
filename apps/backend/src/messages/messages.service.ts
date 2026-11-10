import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, MediaKind, MessageType, ConversationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginate, PaginatedResult } from '../common/dto/pagination.dto';
import { StartConversationDto, SendMessageDto } from './dto/message.dto';
import {
  MESSAGE_INCLUDE,
  CONVERSATION_INCLUDE,
  MessageWithRelations,
  ConversationWithRelations,
  toMessageApi,
  toConversationApi,
} from './message.mapper';

export interface SendMessageResult {
  message: ReturnType<typeof toMessageApi>;
  conversationId: string;
  senderId: string;
  participantIds: string[];
}

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------ Conversations ----------------------------

  async startConversation(
    userId: string,
    dto: StartConversationDto,
  ): Promise<ReturnType<typeof toConversationApi>> {
    const type = dto.type ?? (dto.participantIds?.length ? ConversationType.GROUP : ConversationType.DIRECT);

    if (type === ConversationType.DIRECT) {
      const other = dto.recipientId ?? dto.participantIds?.[0];
      if (!other) throw new BadRequestException('recipientId is required for a direct message');
      if (other === userId) throw new BadRequestException('You cannot message yourself');
      await this.assertUserExists(other);

      const existing = await this.findDirectConversation(userId, other);
      if (existing) return this.getConversation(userId, existing.id);

      const created = await this.prisma.conversation.create({
        data: {
          type: ConversationType.DIRECT,
          participants: { create: [{ userId }, { userId: other }] },
        },
        include: CONVERSATION_INCLUDE,
      });
      return toConversationApi(created as ConversationWithRelations, userId, 0);
    }

    // GROUP
    const ids = Array.from(new Set([userId, ...(dto.participantIds ?? [])]));
    if (ids.length < 2) throw new BadRequestException('A group needs at least 2 participants');
    const created = await this.prisma.conversation.create({
      data: {
        type: ConversationType.GROUP,
        title: dto.title ?? null,
        participants: { create: ids.map((id) => ({ userId: id })) },
      },
      include: CONVERSATION_INCLUDE,
    });
    return toConversationApi(created as ConversationWithRelations, userId, 0);
  }

  private async findDirectConversation(a: string, b: string) {
    return this.prisma.conversation.findFirst({
      where: {
        type: ConversationType.DIRECT,
        participants: { some: { userId: a } },
        AND: [{ participants: { some: { userId: b } } }],
      },
      select: { id: true },
    });
  }

  private async assertUserExists(id: string): Promise<void> {
    const u = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!u) throw new NotFoundException('User not found');
  }

  async listConversations(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<ReturnType<typeof toConversationApi>>> {
    const where = { participants: { some: { userId } } };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.conversation.findMany({
        where,
        include: CONVERSATION_INCLUDE,
        orderBy: { lastMessageAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.conversation.count({ where }),
    ]);

    const items = await Promise.all(
      rows.map(async (c) => {
        const unread = await this.unreadCount(userId, c.id);
        return toConversationApi(c as ConversationWithRelations, userId, unread);
      }),
    );
    return paginate(items, total, page, limit);
  }

  private async unreadCount(userId: string, conversationId: string): Promise<number> {
    const me = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { lastReadAt: true },
    });
    return this.prisma.message.count({
      where: {
        conversationId,
        senderId: { not: userId },
        deletedAt: null,
        ...(me?.lastReadAt ? { createdAt: { gt: me.lastReadAt } } : {}),
      },
    });
  }

  async getConversation(
    userId: string,
    conversationId: string,
  ): Promise<ReturnType<typeof toConversationApi>> {
    await this.assertParticipant(userId, conversationId);
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: CONVERSATION_INCLUDE,
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    const unread = await this.unreadCount(userId, conversationId);
    return toConversationApi(conv as ConversationWithRelations, userId, unread);
  }

  async assertParticipant(userId: string, conversationId: string): Promise<void> {
    const p = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { id: true },
    });
    if (!p) throw new ForbiddenException('You are not a participant of this conversation');
  }

  async getParticipantIds(conversationId: string): Promise<string[]> {
    const rows = await this.prisma.conversationParticipant.findMany({
      where: { conversationId },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  }

  async getMessages(
    userId: string,
    conversationId: string,
    page = 1,
    limit = 50,
  ): Promise<PaginatedResult<ReturnType<typeof toMessageApi>>> {
    await this.assertParticipant(userId, conversationId);
    const where = { conversationId, deletedAt: null };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.message.findMany({
        where,
        include: MESSAGE_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.message.count({ where }),
    ]);
    // Return oldest→newest for chat rendering.
    return paginate(rows.reverse().map((m) => toMessageApi(m as MessageWithRelations)), total, page, limit);
  }

  // -------------------------------- Messages -------------------------------

  async sendMessage(userId: string, dto: SendMessageDto): Promise<SendMessageResult> {
    let conversationId = dto.conversationId;

    if (!conversationId && dto.recipientId) {
      const conv = await this.startConversation(userId, { recipientId: dto.recipientId });
      conversationId = conv.id;
    }
    if (!conversationId) throw new BadRequestException('conversationId or recipientId is required');

    await this.assertParticipant(userId, conversationId);
    if (!dto.body?.trim() && !dto.media?.length)
      throw new BadRequestException('Message must have a body or media');

    const type = dto.type ?? (dto.media?.length ? this.inferType(dto.media) : MessageType.TEXT);

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        type: type as MessageType,
        body: dto.body ?? null,
        readBy: [userId],
        media: dto.media?.length
          ? {
              create: dto.media.map((m) => ({
                url: m.url,
                kind: (m.kind ?? 'IMAGE') as MediaKind,
                mimeType: m.mimeType ?? null,
              })),
            }
          : undefined,
      },
      include: MESSAGE_INCLUDE,
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    const participantIds = await this.getParticipantIds(conversationId);
    return {
      message: toMessageApi(message as MessageWithRelations),
      conversationId,
      senderId: userId,
      participantIds,
    };
  }

  private inferType(media: { kind?: string }[]): MessageType {
    const kinds = media.map((m) => m.kind);
    if (kinds.includes('VIDEO')) return MessageType.VIDEO;
    if (kinds.includes('IMAGE')) return MessageType.IMAGE;
    if (kinds.includes('FILE')) return MessageType.FILE;
    return MessageType.TEXT;
  }

  async markRead(
    userId: string,
    conversationId: string,
  ): Promise<{ conversationId: string; readerId: string; readAt: string }> {
    await this.assertParticipant(userId, conversationId);
    const readAt = new Date();
    await this.prisma.$transaction([
      this.prisma.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId } },
        data: { lastReadAt: readAt },
      }),
      this.prisma.message.updateMany({
        where: { conversationId, senderId: { not: userId }, deletedAt: null },
        data: { readBy: { push: userId } },
      }),
    ]);
    return { conversationId, readerId: userId, readAt: readAt.toISOString() };
  }

  async deleteMessage(
    userId: string,
    messageId: string,
  ): Promise<{ conversationId: string; messageId: string }> {
    const message = await this.prisma.message.findFirst({ where: { id: messageId, deletedAt: null } });
    if (!message) throw new NotFoundException('Message not found');
    if (message.senderId !== userId)
      throw new ForbiddenException('You can only delete your own messages');
    await this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date(), body: null },
    });
    return { conversationId: message.conversationId, messageId };
  }
}
