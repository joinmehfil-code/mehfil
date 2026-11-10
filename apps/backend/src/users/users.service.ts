import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import {
  ConnectionStatus,
  PublicUser,
  UserProfile,
  SkillRelation,
  SubscriptionTier,
} from '@mehfil/shared';
import { PrismaService } from '../prisma/prisma.service';
import { paginate, PaginatedResult } from '../common/dto/pagination.dto';
import { toPublicUser, toUserProfile, toAuthor } from './user.mapper';
import { UpdateProfileDto, SearchUsersQueryDto } from './dto/user.dto';

const USER_INCLUDE = {
  _count: {
    select: { followsReceived: true, followsInitiated: true },
  },
} satisfies Prisma.UserInclude;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Fetch a single user row (internal). Throws if missing/deleted. */
  async findUserById(id: string): Promise<User> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' }, deletedAt: null },
    });
  }

  /** Full profile for the authenticated owner. */
  async getMyProfile(userId: string): Promise<UserProfile> {
    const user = await this.prisma.user.findFirstOrThrow({
      where: { id: userId, deletedAt: null },
      include: {
        ...USER_INCLUDE,
        skills: true,
        subscription: true,
      },
    });
    return toUserProfile(user, {
      skillsOffered: user.skills
        .filter((s) => s.relation === SkillRelation.OFFER)
        .map((s) => s.name),
      skillsWanted: user.skills
        .filter((s) => s.relation === SkillRelation.WANT)
        .map((s) => s.name),
      tier: user.subscription?.tier as SubscriptionTier | undefined,
    });
  }

  /** Public profile viewed by someone else (respects visibility + blocks). */
  async getPublicProfile(viewerId: string | undefined, identifier: string): Promise<PublicUser> {
    const user = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [{ id: identifier }, { username: { equals: identifier, mode: 'insensitive' } }],
      },
      include: USER_INCLUDE,
    });
    if (!user) throw new NotFoundException('User not found');

    // Private profiles are hidden from non-followers.
    if (user.visibility === 'PRIVATE' && viewerId !== user.id) {
      const isFollowing = viewerId
        ? await this.isFollowing(viewerId, user.id)
        : false;
      if (!isFollowing) {
        return {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: null,
          bio: null,
          city: null,
          country: null,
          interests: [],
          followersCount: user._count?.followsReceived ?? 0,
          followingCount: 0,
        };
      }
    }

    const ctx: { isFollowing?: boolean; connectionStatus?: ConnectionStatus } = {};
    if (viewerId && viewerId !== user.id) {
      ctx.isFollowing = await this.isFollowing(viewerId, user.id);
      ctx.connectionStatus = await this.connectionStatus(viewerId, user.id);
    }
    return toPublicUser(user, ctx);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserProfile> {
    await this.findUserById(userId);
    const data: Prisma.UserUpdateInput = {};
    const fields: (keyof UpdateProfileDto)[] = [
      'displayName', 'bio', 'aboutMe', 'avatarUrl', 'coverUrl',
      'city', 'country', 'location', 'interests', 'visibility', 'timezone', 'locale',
    ];
    for (const f of fields) {
      if (dto[f] !== undefined) (data as Record<string, unknown>)[f] = dto[f];
    }
    await this.prisma.user.update({ where: { id: userId }, data });
    return this.getMyProfile(userId);
  }

  /** Discover/search people with filters. */
  async searchUsers(
    viewerId: string,
    query: SearchUsersQueryDto,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<PublicUser>> {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      status: 'ACTIVE',
      id: { not: viewerId },
      // Never surface users who blocked the viewer (or whom viewer blocked).
      NOT: {
        OR: [
          { blocksInitiated: { some: { blockedId: viewerId } } },
          { blocksReceived: { some: { blockerId: viewerId } } },
        ],
      },
    };
    if (query.q) {
      where.OR = [
        { username: { contains: query.q, mode: 'insensitive' } },
        { displayName: { contains: query.q, mode: 'insensitive' } },
        { bio: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    if (query.city) where.city = { equals: query.city, mode: 'insensitive' };
    if (query.interest) where.interests = { has: query.interest };
    if (query.skill) {
      where.skills = { some: { name: { contains: query.skill, mode: 'insensitive' } } };
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: USER_INCLUDE,
        orderBy: [{ isVerified: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    // Enrich with follow state in one query.
    const follows = await this.prisma.follow.findMany({
      where: { followerId: viewerId, followingId: { in: rows.map((r) => r.id) } },
      select: { followingId: true },
    });
    const followingSet = new Set(follows.map((f) => f.followingId));

    const items = rows.map((r) =>
      toPublicUser(r, { isFollowing: followingSet.has(r.id) }),
    );
    return paginate(items, total, page, limit);
  }

  /** Suggested connections: shared interests/city, not already followed. */
  async suggestions(userId: string, limit = 10): Promise<PublicUser[]> {
    const me = await this.findUserById(userId);
    const alreadyFollowing = await this.prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const exclude = new Set([userId, ...alreadyFollowing.map((f) => f.followingId)]);

    const candidates = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        id: { notIn: Array.from(exclude) },
        OR: [
          { interests: { hasSome: me.interests.length ? me.interests : ['__none__'] } },
          ...(me.city ? [{ city: { equals: me.city, mode: 'insensitive' as const } }] : []),
        ],
      },
      include: USER_INCLUDE,
      orderBy: [{ isVerified: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });
    return candidates.map((c) => toPublicUser(c, { isFollowing: false }));
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const f = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });
    return !!f && f.status === 'ACCEPTED';
  }

  async connectionStatus(viewerId: string, otherId: string): Promise<ConnectionStatus> {
    const blocked = await this.prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId: viewerId, blockedId: otherId } },
    });
    if (blocked) return ConnectionStatus.BLOCKED;
    const follow = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: viewerId, followingId: otherId } },
    });
    if (!follow) return ConnectionStatus.NONE;
    return follow.status === 'PENDING'
      ? ConnectionStatus.PENDING
      : ConnectionStatus.ACCEPTED;
  }

  /** Follow another user (creates or re-activates the follow edge). */
  async follow(followerId: string, followingId: string): Promise<{ following: boolean }> {
    if (followerId === followingId)
      throw new BadRequestException('You cannot follow yourself');
    await this.findUserById(followingId);

    const blockedMe = await this.prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId: followingId, blockedId: followerId } },
    });
    if (blockedMe)
      throw new BadRequestException('You cannot follow this user');

    await this.prisma.follow.upsert({
      where: { followerId_followingId: { followerId, followingId } },
      create: { followerId, followingId, status: 'ACCEPTED' },
      update: { status: 'ACCEPTED' },
    });
    return { following: true };
  }

  async unfollow(followerId: string, followingId: string): Promise<{ following: boolean }> {
    await this.prisma.follow.deleteMany({
      where: { followerId, followingId },
    });
    return { following: false };
  }

  async block(blockerId: string, blockedId: string): Promise<{ blocked: boolean }> {
    if (blockerId === blockedId)
      throw new BadRequestException('You cannot block yourself');
    await this.prisma.$transaction([
      this.prisma.block.upsert({
        where: { blockerId_blockedId: { blockerId, blockedId } },
        create: { blockerId, blockedId },
        update: {},
      }),
      // Remove any follow edges in both directions.
      this.prisma.follow.deleteMany({
        where: {
          OR: [
            { followerId: blockerId, followingId: blockedId },
            { followerId: blockedId, followingId: blockerId },
          ],
        },
      }),
    ]);
    return { blocked: true };
  }

  async unblock(blockerId: string, blockedId: string): Promise<{ blocked: boolean }> {
    await this.prisma.block.deleteMany({ where: { blockerId, blockedId } });
    return { blocked: false };
  }

  async listFollowers(userId: string, page = 1, limit = 20): Promise<PaginatedResult<PublicUser>> {
    const where: Prisma.FollowWhereInput = { followingId: userId, status: 'ACCEPTED' };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.follow.findMany({
        where,
        include: { follower: { include: USER_INCLUDE } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.follow.count({ where }),
    ]);
    return paginate(rows.map((r) => toPublicUser(r.follower)), total, page, limit);
  }

  async listFollowing(userId: string, page = 1, limit = 20): Promise<PaginatedResult<PublicUser>> {
    const where: Prisma.FollowWhereInput = { followerId: userId, status: 'ACCEPTED' };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.follow.findMany({
        where,
        include: { following: { include: USER_INCLUDE } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.follow.count({ where }),
    ]);
    return paginate(rows.map((r) => toPublicUser(r.following)), total, page, limit);
  }

  /** Upsert a skill (offer/want) on the user's profile. */
  async upsertSkill(userId: string, name: string, relation: SkillRelation, level?: string) {
    await this.prisma.userSkill.upsert({
      where: { userId_name_relation: { userId, name, relation } },
      create: { userId, name, relation, level },
      update: { level },
    });
    return this.getSkills(userId);
  }

  async removeSkill(userId: string, name: string, relation: SkillRelation) {
    await this.prisma.userSkill.deleteMany({ where: { userId, name, relation } });
    return this.getSkills(userId);
  }

  async getSkills(userId: string): Promise<{ offered: string[]; wanted: string[] }> {
    const skills = await this.prisma.userSkill.findMany({ where: { userId } });
    return {
      offered: skills.filter((s) => s.relation === 'OFFER').map((s) => s.name),
      wanted: skills.filter((s) => s.relation === 'WANT').map((s) => s.name),
    };
  }

  /** Find people by a skill they offer. */
  async findPeopleBySkill(viewerId: string, skill: string, limit = 20): Promise<PublicUser[]> {
    const rows = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        id: { not: viewerId },
        skills: {
          some: { relation: 'OFFER', name: { contains: skill, mode: 'insensitive' } },
        },
      },
      include: USER_INCLUDE,
      take: limit,
    });
    return rows.map((r) => toPublicUser(r));
  }

  /** Helper reused by other modules to embed an author. */
  authorOf(user: Pick<User, 'id' | 'username' | 'displayName' | 'avatarUrl'>) {
    return toAuthor(user);
  }
}
