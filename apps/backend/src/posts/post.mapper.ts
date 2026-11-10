import { Prisma, Comment, Media, User } from '@prisma/client';
import {
  Post as PostApi,
  Comment as CommentApi,
  MediaAttachment,
  PostType,
  PostStatus,
  ReactionType,
} from '@mehfil/shared';
import { toAuthor } from '../users/user.mapper';

type Author = Pick<User, 'id' | 'username' | 'displayName' | 'avatarUrl'>;

/** Canonical include used by every post query — the API type is derived from it. */
export const POST_INCLUDE = {
  author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
  media: true,
  poll: { include: { options: true } },
  community: { select: { id: true, name: true, slug: true } },
  reactions: { select: { userId: true, type: true } },
  _count: { select: { comments: true } },
} satisfies Prisma.PostInclude;

export type PostWithRelations = Prisma.PostGetPayload<{ include: typeof POST_INCLUDE }>;

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

export function toPostApi(post: PostWithRelations, viewerId?: string): PostApi {
  const myReaction =
    viewerId && post.reactions
      ? ((post.reactions.find((r) => r.userId === viewerId)?.type as string) as ReactionType) ?? null
      : null;

  const canManage = viewerId ? viewerId === post.authorId : false;
  const likeCount = post.reactions
    ? post.reactions.filter((r) => r.type === 'LIKE').length
    : post.likeCount;

  return {
    id: post.id,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    author: toAuthor(post.author),
    type: post.type as PostType,
    status: post.status as PostStatus,
    content: post.content,
    media: (post.media ?? []).map(mediaToApi),
    poll: post.poll
      ? {
          id: post.poll.id,
          question: post.poll.question,
          endsAt: post.poll.endsAt ? post.poll.endsAt.toISOString() : null,
          options: post.poll.options.map((o) => ({
            id: o.id,
            text: o.text,
            votes: o.votes,
            ...(viewerId ? { votedByMe: false } : {}),
          })),
        }
      : null,
    communityId: post.communityId,
    community: post.community ?? null,
    spaceId: post.spaceId,
    eventId: post.eventId,
    isPinned: post.isPinned,
    hashtags: post.hashtags ?? [],
    mentions: post.mentions ?? [],
    likeCount,
    commentCount: post._count?.comments ?? post.commentCount ?? 0,
    shareCount: post.shareCount ?? 0,
    myReaction,
    canEdit: canManage,
    canDelete: canManage,
  };
}

export interface CommentWithRelations extends Comment {
  author: Author;
  replies?: CommentWithRelations[];
  reactions?: { userId: string; type: string }[];
}

export function toCommentApi(c: CommentWithRelations, viewerId?: string): CommentApi {
  const likeCount = c.reactions
    ? c.reactions.filter((r) => r.type === 'LIKE').length
    : c.likeCount;
  const myReaction =
    viewerId && c.reactions
      ? ((c.reactions.find((r) => r.userId === viewerId)?.type as string) as ReactionType) ?? null
      : null;
  return {
    id: c.id,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    author: toAuthor(c.author),
    postId: c.postId,
    parentId: c.parentId,
    content: c.content,
    likeCount,
    myReaction,
    replies: (c.replies ?? []).map((r) => toCommentApi(r, viewerId)),
  };
}
