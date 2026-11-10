import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, MediaKind } from '@prisma/client';
import { PostType, PostStatus, ReactionType, NotificationType } from '@mehfil/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { paginate, PaginatedResult } from '../common/dto/pagination.dto';
import { extractHashtags, extractMentions } from '../common/utils/serialize.util';
import { CreatePostDto, UpdatePostDto, CreateCommentDto } from './dto/post.dto';
import { toPostApi, toCommentApi, PostWithRelations, CommentWithRelations, POST_INCLUDE } from './post.mapper';

const AUTHOR_SELECT = { id: true, username: true, displayName: true, avatarUrl: true } as const;

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private async blockedIds(viewerId: string): Promise<string[]> {
    const [a, b] = await this.prisma.$transaction([
      this.prisma.block.findMany({ where: { blockerId: viewerId }, select: { blockedId: true } }),
      this.prisma.block.findMany({ where: { blockedId: viewerId }, select: { blockerId: true } }),
    ]);
    return Array.from(new Set([...a.map((x) => x.blockedId), ...b.map((x) => x.blockerId)]));
  }

  async createPost(userId: string, dto: CreatePostDto): Promise<PostWithRelations> {
    const hashtags = extractHashtags(dto.content);
    const mentions = extractMentions(dto.content);

    // If posting into a community, verify membership.
    if (dto.communityId) {
      const member = await this.prisma.communityMember.findUnique({
        where: { communityId_userId: { communityId: dto.communityId, userId } },
      });
      if (!member || member.status !== 'ACTIVE')
        throw new ForbiddenException('You must be a member to post in this community');
    }

    const type = dto.type ?? this.inferType(dto);
    const status = dto.status ?? (dto.scheduledFor ? PostStatus.SCHEDULED : PostStatus.PUBLISHED);

    const post = await this.prisma.post.create({
      data: {
        authorId: userId,
        type: type as PostType,
        status: status as PostStatus,
        content: dto.content ?? null,
        communityId: dto.communityId ?? null,
        spaceId: dto.spaceId ?? null,
        eventId: dto.eventId ?? null,
        hashtags,
        mentions,
        scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : null,
        media: dto.media?.length
          ? {
              create: dto.media.map((m) => ({
                url: m.url,
                kind: (m.kind ?? 'IMAGE') as MediaKind,
                mimeType: m.mimeType ?? null,
              })),
            }
          : undefined,
        poll: dto.poll
          ? {
              create: {
                question: dto.poll.question,
                endsAt: dto.poll.endsAt ? new Date(dto.poll.endsAt) : null,
                options: { create: dto.poll.options.map((o) => ({ text: o.text })) },
              },
            }
          : undefined,
      },
      include: POST_INCLUDE,
    });

    if (dto.communityId) {
      await this.prisma.community.update({
        where: { id: dto.communityId },
        data: { postCount: { increment: 1 } },
      });
    }

    // Notify mentioned users.
    if (mentions.length) {
      const mentioned = await this.prisma.user.findMany({
        where: { username: { in: mentions } },
        select: { id: true, username: true },
      });
      await this.notifications.createMany(
        mentioned.map((m) => m.id),
        {
          type: NotificationType.MENTION,
          title: 'You were mentioned',
          body: `@${mentions.join(', ')} mentioned you in a post`,
          actorId: userId,
          targetType: 'POST',
          targetId: post.id,
          deepLink: `/post/${post.id}`,
        },
      );
    }

    return post;
  }

  private inferType(dto: CreatePostDto): PostType {
    if (dto.poll) return PostType.POLL;
    const kinds = (dto.media ?? []).map((m) => m.kind);
    if (kinds.includes('VIDEO')) return PostType.VIDEO;
    if (kinds.includes('IMAGE')) return PostType.IMAGE;
    if (kinds.includes('FILE')) return PostType.FILE;
    return PostType.TEXT;
  }

  async updatePost(userId: string, postId: string, dto: UpdatePostDto): Promise<PostWithRelations> {
    const post = await this.prisma.post.findFirst({ where: { id: postId, deletedAt: null } });
    if (!post) throw new NotFoundException('Post not found');
    await this.assertCanManage(userId, post.authorId);

    const data: Prisma.PostUpdateInput = {};
    if (dto.content !== undefined) {
      data.content = dto.content;
      data.hashtags = extractHashtags(dto.content);
      data.mentions = extractMentions(dto.content);
    }
    if (dto.status !== undefined) data.status = dto.status as PostStatus;
    if (dto.isPinned !== undefined) data.isPinned = dto.isPinned;

    return this.prisma.post.update({ where: { id: postId }, data, include: POST_INCLUDE });
  }

  async deletePost(userId: string, postId: string, isAdmin = false): Promise<{ success: boolean }> {
    const post = await this.prisma.post.findFirst({ where: { id: postId, deletedAt: null } });
    if (!post) throw new NotFoundException('Post not found');
    if (!isAdmin) await this.assertCanManage(userId, post.authorId);
    await this.prisma.post.update({
      where: { id: postId },
      data: { deletedAt: new Date(), status: PostStatus.REMOVED },
    });
    return { success: true };
  }

  async getPost(postId: string, viewerId?: string): Promise<ReturnType<typeof toPostApi>> {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, deletedAt: null },
      include: POST_INCLUDE,
    });
    if (!post) throw new NotFoundException('Post not found');
    return toPostApi(post, viewerId);
  }

  /** Personalized feed: own + followed users + public posts, minus blocked. */
  async getFeed(
    viewerId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<ReturnType<typeof toPostApi>>> {
    const blocked = await this.blockedIds(viewerId);
    const following = await this.prisma.follow.findMany({
      where: { followerId: viewerId, status: 'ACCEPTED' },
      select: { followingId: true },
    });
    const authorIds = [viewerId, ...following.map((f) => f.followingId)];

    const where: Prisma.PostWhereInput = {
      deletedAt: null,
      status: PostStatus.PUBLISHED,
      authorId: { notIn: blocked },
      OR: [{ authorId: { in: authorIds } }, { communityId: null, authorId: { notIn: blocked } }],
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where,
        include: POST_INCLUDE,
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.post.count({ where }),
    ]);

    return paginate(rows.map((p) => toPostApi(p, viewerId)), total, page, limit);
  }

  async getUserPosts(
    authorId: string,
    viewerId: string | undefined,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<ReturnType<typeof toPostApi>>> {
    const where: Prisma.PostWhereInput = {
      authorId,
      deletedAt: null,
      status: PostStatus.PUBLISHED,
      communityId: null, // profile shows personal posts
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where,
        include: POST_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.post.count({ where }),
    ]);
    return paginate(rows.map((p) => toPostApi(p, viewerId)), total, page, limit);
  }

  async getCommunityPosts(
    communityId: string,
    viewerId: string | undefined,
    page = 1,
    limit = 20,
    spaceId?: string,
  ): Promise<PaginatedResult<ReturnType<typeof toPostApi>>> {
    const where: Prisma.PostWhereInput = {
      communityId,
      deletedAt: null,
      status: PostStatus.PUBLISHED,
      ...(spaceId ? { spaceId } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where,
        include: POST_INCLUDE,
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.post.count({ where }),
    ]);
    return paginate(rows.map((p) => toPostApi(p, viewerId)), total, page, limit);
  }

  /** Trending posts by engagement in a time window. */
  async trending(viewerId: string, page = 1, limit = 20): Promise<PaginatedResult<ReturnType<typeof toPostApi>>> {
    const blocked = await this.blockedIds(viewerId);
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const where: Prisma.PostWhereInput = {
      deletedAt: null,
      status: PostStatus.PUBLISHED,
      createdAt: { gte: since },
      authorId: { notIn: blocked },
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where,
        include: POST_INCLUDE,
        orderBy: [{ likeCount: 'desc' }, { commentCount: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.post.count({ where }),
    ]);
    return paginate(rows.map((p) => toPostApi(p, viewerId)), total, page, limit);
  }

  async getByHashtag(tag: string, viewerId: string, page = 1, limit = 20) {
    const clean = tag.replace(/^#/, '').toLowerCase();
    const where: Prisma.PostWhereInput = {
      deletedAt: null,
      status: PostStatus.PUBLISHED,
      hashtags: { has: clean },
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where,
        include: POST_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.post.count({ where }),
    ]);
    return paginate(rows.map((p) => toPostApi(p, viewerId)), total, page, limit);
  }

  // ------------------------------- Reactions -------------------------------

  async toggleReaction(
    userId: string,
    target: { postId?: string; commentId?: string },
    type: ReactionType = ReactionType.LIKE,
  ): Promise<{ reacted: boolean; type: ReactionType | null; likeCount: number }> {
    const { postId, commentId } = target;
    if (!postId && !commentId) throw new BadRequestException('postId or commentId required');

    const existing = await this.prisma.reaction.findFirst({
      where: { userId, postId: postId ?? null, commentId: commentId ?? null },
    });

    // Same type => remove (toggle off). Different type => switch.
    if (existing && existing.type === type) {
      await this.prisma.reaction.delete({ where: { id: existing.id } });
      await this.adjustCount(postId, commentId, -1, type);
      return { reacted: false, type: null, likeCount: await this.countLikes(postId, commentId) };
    }

    const switched = existing && existing.type !== type;
    await this.prisma.reaction.upsert({
      where: { id: existing?.id ?? '__new__' },
      create: { userId, postId, commentId, type: type as ReactionType },
      update: { type: type as ReactionType },
    }).catch(async () => {
      // upsert needs a unique where; fall back to create/update by composite key.
      if (postId) {
        await this.prisma.reaction.upsert({
          where: { userId_postId: { userId, postId } },
          create: { userId, postId, type: type as ReactionType },
          update: { type: type as ReactionType },
        });
      } else if (commentId) {
        await this.prisma.reaction.upsert({
          where: { userId_commentId: { userId, commentId } },
          create: { userId, commentId, type: type as ReactionType },
          update: { type: type as ReactionType },
        });
      }
    });

    if (!switched) await this.adjustCount(postId, commentId, +1, type);

    // Notify the content author about a LIKE.
    if (!switched && type === ReactionType.LIKE) {
      await this.notifyReaction(userId, postId, commentId);
    }

    return { reacted: true, type, likeCount: await this.countLikes(postId, commentId) };
  }

  private async adjustCount(postId?: string, commentId?: string, delta = 0, type?: ReactionType) {
    if (type !== ReactionType.LIKE) return; // only LIKE updates the counter
    if (postId) {
      await this.prisma.post.update({
        where: { id: postId },
        data: { likeCount: { increment: delta } },
      });
    } else if (commentId) {
      await this.prisma.comment.update({
        where: { id: commentId },
        data: { likeCount: { increment: delta } },
      });
    }
  }

  private async countLikes(postId?: string, commentId?: string): Promise<number> {
    return this.prisma.reaction.count({
      where: { type: 'LIKE', postId: postId ?? null, commentId: commentId ?? null },
    });
  }

  private async notifyReaction(actorId: string, postId?: string, commentId?: string) {
    let authorId: string | null = null;
    if (postId) {
      const p = await this.prisma.post.findUnique({ where: { id: postId }, select: { authorId: true } });
      authorId = p?.authorId ?? null;
    } else if (commentId) {
      const c = await this.prisma.comment.findUnique({ where: { id: commentId }, select: { authorId: true, postId: true } });
      authorId = c?.authorId ?? null;
      postId = c?.postId ?? postId;
    }
    if (authorId && authorId !== actorId) {
      await this.notifications.create({
        userId: authorId,
        type: NotificationType.POST_LIKE,
        title: 'New like',
        body: 'Someone liked your content',
        actorId,
        targetType: postId ? 'POST' : 'COMMENT',
        targetId: postId ?? commentId ?? undefined,
        deepLink: postId ? `/post/${postId}` : undefined,
      });
    }
  }

  // ------------------------------- Comments -------------------------------

  async addComment(userId: string, postId: string, dto: CreateCommentDto): Promise<CommentWithRelations> {
    const post = await this.prisma.post.findFirst({ where: { id: postId, deletedAt: null } });
    if (!post) throw new NotFoundException('Post not found');

    const comment = await this.prisma.comment.create({
      data: {
        postId,
        authorId: userId,
        parentId: dto.parentId ?? null,
        content: dto.content,
      },
      include: { author: { select: AUTHOR_SELECT } },
    });

    await this.prisma.post.update({
      where: { id: postId },
      data: { commentCount: { increment: 1 } },
    });

    // Notify post author (or parent comment author for replies).
    const targetAuthor = dto.parentId
      ? (await this.prisma.comment.findUnique({ where: { id: dto.parentId }, select: { authorId: true } }))?.authorId
      : post.authorId;
    if (targetAuthor && targetAuthor !== userId) {
      await this.notifications.create({
        userId: targetAuthor,
        type: dto.parentId ? NotificationType.COMMENT_REPLY : NotificationType.POST_COMMENT,
        title: dto.parentId ? 'New reply' : 'New comment',
        body: dto.content.slice(0, 80),
        actorId: userId,
        targetType: 'POST',
        targetId: postId,
        deepLink: `/post/${postId}`,
      });
    }

    return comment;
  }

  async listComments(postId: string, viewerId?: string, limit = 50): Promise<ReturnType<typeof toCommentApi>[]> {
    const roots = await this.prisma.comment.findMany({
      where: { postId, parentId: null, deletedAt: null },
      include: { author: { select: AUTHOR_SELECT }, replies: { include: { author: { select: AUTHOR_SELECT } }, where: { deletedAt: null } } },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    return roots.map((c) => toCommentApi(c as CommentWithRelations, viewerId));
  }

  async deleteComment(userId: string, commentId: string, isAdmin = false): Promise<{ success: boolean }> {
    const comment = await this.prisma.comment.findFirst({ where: { id: commentId, deletedAt: null } });
    if (!comment) throw new NotFoundException('Comment not found');
    if (!isAdmin) await this.assertCanManage(userId, comment.authorId);
    await this.prisma.comment.update({ where: { id: commentId }, data: { deletedAt: new Date(), content: '[deleted]' } });
    await this.prisma.post.update({ where: { id: comment.postId }, data: { commentCount: { decrement: 1 } } });
    return { success: true };
  }

  // ------------------------------- Bookmarks -------------------------------

  async toggleBookmark(userId: string, postId: string): Promise<{ bookmarked: boolean }> {
    const existing = await this.prisma.bookmark.findUnique({
      where: { userId_postId: { userId, postId } },
    });
    if (existing) {
      await this.prisma.bookmark.delete({ where: { id: existing.id } });
      return { bookmarked: false };
    }
    await this.prisma.bookmark.create({ data: { userId, postId } });
    return { bookmarked: true };
  }

  async listBookmarks(userId: string, page = 1, limit = 20) {
    const where = { userId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.bookmark.findMany({
        where,
        include: { post: { include: POST_INCLUDE } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.bookmark.count({ where }),
    ]);
    return paginate(
      rows.map((r) => toPostApi(r.post as PostWithRelations, userId)),
      total,
      page,
      limit,
    );
  }

  // --------------------------------- Polls ---------------------------------

  async votePoll(userId: string, optionId: string): Promise<{ votes: number }> {
    const option = await this.prisma.pollOption.findUnique({
      where: { id: optionId },
      include: { poll: { include: { post: { select: { id: true } } } } },
    });
    if (!option) throw new NotFoundException('Poll option not found');
    if (option.poll.endsAt && option.poll.endsAt < new Date())
      throw new BadRequestException('This poll has ended');

    const existing = await this.prisma.pollVote.findUnique({
      where: { optionId_userId: { optionId, userId } },
    });
    if (existing) return { votes: option.votes };

    await this.prisma.$transaction([
      this.prisma.pollVote.create({ data: { optionId, userId } }),
      this.prisma.pollOption.update({ where: { id: optionId }, data: { votes: { increment: 1 } } }),
    ]);
    return { votes: option.votes + 1 };
  }

  async sharePost(postId: string): Promise<{ shareCount: number }> {
    const post = await this.prisma.post.update({
      where: { id: postId },
      data: { shareCount: { increment: 1 } },
      select: { shareCount: true },
    });
    return { shareCount: post.shareCount };
  }

  private async assertCanManage(userId: string, authorId: string): Promise<void> {
    if (userId !== authorId) {
      const me = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
      if (me?.role !== 'ADMIN' && me?.role !== 'SUPER_ADMIN' && me?.role !== 'MODERATOR') {
        throw new ForbiddenException('You can only manage your own content');
      }
    }
  }
}
