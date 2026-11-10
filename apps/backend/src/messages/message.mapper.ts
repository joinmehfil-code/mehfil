import { Prisma, Media } from '@prisma/client';
import {
  Message as MessageApi,
  Conversation as ConversationApi,
  ConversationParticipant as ConversationParticipantApi,
  MediaAttachment,
  MessageType,
  ConversationType,
} from '@mehfil/shared';
import { toAuthor } from '../users/user.mapper';
import { toIso } from '../common/utils/serialize.util';

export const AUTHOR_SELECT = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

/** Canonical include for a message — the API type derives from it. */
export const MESSAGE_INCLUDE = {
  sender: { select: AUTHOR_SELECT },
  media: true,
} satisfies Prisma.MessageInclude;

export type MessageWithRelations = Prisma.MessageGetPayload<{ include: typeof MESSAGE_INCLUDE }>;

/** Include for a conversation with participants + latest message. */
export const CONVERSATION_INCLUDE = {
  participants: { include: { user: { select: AUTHOR_SELECT } } },
  messages: { take: 1, orderBy: { createdAt: 'desc' as const }, include: MESSAGE_INCLUDE },
} satisfies Prisma.ConversationInclude;

export type ConversationWithRelations = Prisma.ConversationGetPayload<{
  include: typeof CONVERSATION_INCLUDE;
}>;

function mediaToApi(m: Media): MediaAttachment {
  return {
    id: m.id,
    url: m.url,
    kind: m.kind as MediaAttachment['kind'],
    mimeType: m.mimeType ?? undefined,
    width: m.width ?? undefined,
    height: m.height ?? undefined,
    thumbnailUrl: m.thumbnailUrl,
  };
}

export function toMessageApi(m: MessageWithRelations): MessageApi {
  return {
    id: m.id,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    conversationId: m.conversationId,
    senderId: m.senderId,
    sender: toAuthor(m.sender),
    type: m.type as MessageType,
    body: m.body,
    media: (m.media ?? []).map(mediaToApi),
    readBy: m.readBy ?? [],
    deletedAt: toIso(m.deletedAt),
  };
}

export function toConversationApi(
  c: ConversationWithRelations,
  viewerId: string,
  unreadCount = 0,
): ConversationApi {
  const participants: ConversationParticipantApi[] = c.participants.map((p) => ({
    user: toAuthor(p.user),
    lastReadAt: toIso(p.lastReadAt),
  }));
  const lastMessage = c.messages?.[0] ? toMessageApi(c.messages[0]) : null;
  return {
    id: c.id,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    type: c.type as ConversationType,
    title: c.title,
    participants,
    lastMessage,
    unreadCount,
  };
}
