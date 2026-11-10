import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { nanoid } from 'nanoid';
import {
  CommunityAccess,
  CommunityRole,
  CommunityMemberStatus,
  SpaceType,
  NotificationType,
} from '@mehfil/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { paginate, PaginatedResult } from '../common/dto/pagination.dto';
import { slugify } from '../common/utils/serialize.util';
import {
  CreateCommunityDto,
  UpdateCommunityDto,
  CreateSpaceDto,
  UpdateSpaceDto,
  InviteMembersDto,
  CommunityQueryDto,
} from './dto/community.dto';
import {
  COMMUNITY_INCLUDE,
  CommunityWithRelations,
  toCommunityApi,
  toSpaceApi,
  toMemberApi,
} from './community.mapper';

/** Numeric weight for community roles — higher means more privileged. */
const ROLE_WEIGHT: Record<CommunityRole, number> = {
  [CommunityRole.OWNER]: 4,
  [CommunityRole.ADMIN]: 3,
  [CommunityRole.MODERATOR]: 2,
  [CommunityRole.MEMBER]: 1,
};

const MEMBER_USER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  bio: true,
  city: true,
  country: true,
  interests: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class CommunitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
  ) {}

  // ------------------------------ Permissions ------------------------------

  private isPlatformStaff(role?: string | null): boolean {
    return role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'MODERATOR';
  }

  private async getMembership(communityId: string, userId?: string) {
    if (!userId) return null;
    return this.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId } },
    });
  }

  private async assertMinRole(
    actorId: string,
    actorRole: string | undefined,
    communityId: string,
    min: CommunityRole,
  ): Promise<void> {
    if (this.isPlatformStaff(actorRole)) return;
    const member = await this.getMembership(communityId, actorId);
    if (!member || member.status !== CommunityMemberStatus.ACTIVE)
      throw new ForbiddenException('You are not an active member of this community');
    if (ROLE_WEIGHT[member.role as CommunityRole] < ROLE_WEIGHT[min])
      throw new ForbiddenException('You do not have permission to do this');
  }

  private async ensureCanView(
    communityId: string,
    access: CommunityAccess | string,
    viewerId?: string,
    viewerRole?: string,
  ): Promise<void> {
    if (access === CommunityAccess.PUBLIC) return;
    if (this.isPlatformStaff(viewerRole)) return;
    const member = await this.getMembership(communityId, viewerId);
    if (!member) throw new NotFoundException('Community not found');
  }

  // --------------------------------- Slug ----------------------------------

  private async uniqueCommunitySlug(base: string): Promise<string> {
    let slug = slugify(base);
    let candidate = slug;
    let i = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const exists = await this.prisma.community.findUnique({ where: { slug: candidate } });
      if (!exists) return candidate;
      i += 1;
      candidate = `${slug}-${i}`;
    }
  }

  // ------------------------------- Create ----------------------------------

  async createCommunity(
    userId: string,
    dto: CreateCommunityDto,
  ): Promise<ReturnType<typeof toCommunityApi>> {
    const slug = dto.slug
      ? await this.uniqueCommunitySlug(dto.slug)
      : await this.uniqueCommunitySlug(dto.name);

    const community = await this.prisma.community.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description ?? null,
        avatarUrl: dto.avatarUrl ?? null,
        coverUrl: dto.coverUrl ?? null,
        access: (dto.access ?? CommunityAccess.PUBLIC) as CommunityAccess,
        category: dto.category ?? null,
        city: dto.city ?? null,
        country: dto.country ?? null,
        ownerId: userId,
        memberCount: 1,
        members: {
          create: {
            userId,
            role: CommunityRole.OWNER,
            status: CommunityMemberStatus.ACTIVE,
          },
        },
      },
      include: COMMUNITY_INCLUDE,
    });

    return toCommunityApi(community as CommunityWithRelations, {
      id: userId,
      role: CommunityRole.OWNER,
    });
  }

  async updateCommunity(
    userId: string,
    userRole: string | undefined,
    communityId: string,
    dto: UpdateCommunityDto,
  ): Promise<ReturnType<typeof toCommunityApi>> {
    const existing = await this.prisma.community.findFirst({
      where: { id: communityId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Community not found');
    await this.assertMinRole(userId, userRole, communityId, CommunityRole.ADMIN);

    const community = await this.prisma.community.update({
      where: { id: communityId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
        ...(dto.coverUrl !== undefined ? { coverUrl: dto.coverUrl } : {}),
        ...(dto.access !== undefined ? { access: dto.access as CommunityAccess } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.city !== undefined ? { city: dto.city } : {}),
        ...(dto.country !== undefined ? { country: dto.country } : {}),
      },
      include: COMMUNITY_INCLUDE,
    });
    const membership = await this.getMembership(communityId, userId);
    return toCommunityApi(community as CommunityWithRelations, {
      id: userId,
      role: membership?.role ?? null,
    });
  }

  async deleteCommunity(
    userId: string,
    userRole: string | undefined,
    communityId: string,
  ): Promise<{ success: boolean }> {
    const existing = await this.prisma.community.findFirst({
      where: { id: communityId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Community not found');
    // Only the owner or platform staff may delete.
    if (existing.ownerId !== userId && !this.isPlatformStaff(userRole)) {
      await this.assertMinRole(userId, userRole, communityId, CommunityRole.OWNER);
    }
    await this.prisma.community.update({
      where: { id: communityId },
      data: { deletedAt: new Date() },
    });
    return { success: true };
  }

  // --------------------------------- Read ----------------------------------

  async getCommunity(
    viewerId: string | undefined,
    viewerRole: string | undefined,
    identifier: string,
  ): Promise<ReturnType<typeof toCommunityApi>> {
    const community = await this.prisma.community.findFirst({
      where: {
        deletedAt: null,
        OR: [{ id: identifier }, { slug: identifier }],
      },
      include: COMMUNITY_INCLUDE,
    });
    if (!community) throw new NotFoundException('Community not found');

    await this.ensureCanView(community.id, community.access, viewerId, viewerRole);

    const membership = viewerId ? await this.getMembership(community.id, viewerId) : null;
    return toCommunityApi(community as CommunityWithRelations, {
      id: viewerId ?? '',
      role: membership?.status === CommunityMemberStatus.ACTIVE ? membership.role : null,
    });
  }

  async discover(
    viewerId: string | undefined,
    query: CommunityQueryDto,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<ReturnType<typeof toCommunityApi>>> {
    const where: Prisma.CommunityWhereInput = {
      deletedAt: null,
      // Never surface SECRET communities in discovery.
      access: { not: CommunityAccess.SECRET },
      ...(query.category ? { category: query.category } : {}),
      ...(query.city ? { city: { equals: query.city, mode: 'insensitive' } } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.community.findMany({
        where,
        include: COMMUNITY_INCLUDE,
        orderBy: [{ memberCount: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.community.count({ where }),
    ]);

    const memberships = viewerId
      ? await this.prisma.communityMember.findMany({
          where: { userId: viewerId, communityId: { in: rows.map((r) => r.id) } },
          select: { communityId: true, role: true, status: true },
        })
      : [];
    const memberMap = new Map(memberships.map((m) => [m.communityId, m]));

    const items = rows.map((c) => {
      const m = memberMap.get(c.id);
      return toCommunityApi(c as CommunityWithRelations, {
        id: viewerId ?? '',
        role: m && m.status === CommunityMemberStatus.ACTIVE ? m.role : null,
      });
    });
    return paginate(items, total, page, limit);
  }

  async myCommunities(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<ReturnType<typeof toCommunityApi>>> {
    const where = {
      userId,
      status: CommunityMemberStatus.ACTIVE,
      community: { deletedAt: null },
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.communityMember.findMany({
        where,
        include: { community: { include: COMMUNITY_INCLUDE } },
        orderBy: { joinedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.communityMember.count({ where }),
    ]);
    const items = rows.map((m) =>
      toCommunityApi(m.community as CommunityWithRelations, { id: userId, role: m.role }),
    );
    return paginate(items, total, page, limit);
  }

  // -------------------------------- Join -----------------------------------

  async join(
    userId: string,
    communityId: string,
  ): Promise<{ status: CommunityMemberStatus; message: string }> {
    const community = await this.prisma.community.findFirst({
      where: { id: communityId, deletedAt: null },
    });
    if (!community) throw new NotFoundException('Community not found');

    const existing = await this.getMembership(communityId, userId);
    if (existing) {
      if (existing.status === CommunityMemberStatus.ACTIVE)
        throw new BadRequestException('You are already a member');
      if (existing.status === CommunityMemberStatus.BANNED)
        throw new ForbiddenException('You are banned from this community');
      if (existing.status === CommunityMemberStatus.PENDING)
        throw new BadRequestException('Your request is already pending');
    }

    // PUBLIC => join instantly. PRIVATE/SECRET => create a pending request.
    const isPublic = community.access === CommunityAccess.PUBLIC;
    const status = isPublic ? CommunityMemberStatus.ACTIVE : CommunityMemberStatus.PENDING;

    if (existing) {
      await this.prisma.communityMember.update({
        where: { id: existing.id },
        data: { status },
      });
    } else {
      await this.prisma.communityMember.create({
        data: { communityId, userId, role: CommunityRole.MEMBER, status },
      });
    }

    if (isPublic) {
      await this.prisma.community.update({
        where: { id: communityId },
        data: { memberCount: { increment: 1 } },
      });
    } else {
      // Notify community admins of the pending request.
      const admins = await this.prisma.communityMember.findMany({
        where: {
          communityId,
          role: { in: [CommunityRole.OWNER, CommunityRole.ADMIN] },
          status: CommunityMemberStatus.ACTIVE,
        },
        select: { userId: true },
      });
      await this.notifications.createMany(
        admins.map((a) => a.userId),
        {
          type: NotificationType.COMMUNITY_JOIN,
          title: 'New join request',
          body: `Someone requested to join ${community.name}`,
          actorId: userId,
          targetType: 'COMMUNITY',
          targetId: communityId,
          deepLink: `/communities/${community.slug}/members`,
        },
      );
    }

    return {
      status,
      message: isPublic ? 'Joined community' : 'Request sent, awaiting approval',
    };
  }

  async leave(userId: string, communityId: string): Promise<{ success: boolean }> {
    const community = await this.prisma.community.findFirst({ where: { id: communityId } });
    if (!community) throw new NotFoundException('Community not found');
    if (community.ownerId === userId)
      throw new BadRequestException('Owners cannot leave; transfer ownership or delete the community');

    const member = await this.getMembership(communityId, userId);
    if (!member) throw new BadRequestException('You are not a member');

    await this.prisma.communityMember.delete({ where: { id: member.id } });
    if (member.status === CommunityMemberStatus.ACTIVE) {
      await this.prisma.community.update({
        where: { id: communityId },
        data: { memberCount: { decrement: 1 } },
      });
    }
    return { success: true };
  }

  // -------------------------------- Members --------------------------------

  async listMembers(
    viewerId: string | undefined,
    viewerRole: string | undefined,
    communityId: string,
    page = 1,
    limit = 20,
    status?: CommunityMemberStatus,
  ): Promise<PaginatedResult<ReturnType<typeof toMemberApi>>> {
    const community = await this.prisma.community.findFirst({ where: { id: communityId } });
    if (!community) throw new NotFoundException('Community not found');
    // Listing non-active members is manager-only.
    if (status && status !== CommunityMemberStatus.ACTIVE) {
      await this.assertMinRole(viewerId ?? '', viewerRole, communityId, CommunityRole.MODERATOR);
    } else {
      await this.ensureCanView(communityId, community.access, viewerId, viewerRole);
    }

    const where: Prisma.CommunityMemberWhereInput = {
      communityId,
      ...(status ? { status } : { status: CommunityMemberStatus.ACTIVE }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.communityMember.findMany({
        where,
        include: { user: { select: MEMBER_USER_SELECT } },
        orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.communityMember.count({ where }),
    ]);
    return paginate(rows.map((m) => toMemberApi(m as never)), total, page, limit);
  }

  async pendingRequests(
    actorId: string,
    actorRole: string | undefined,
    communityId: string,
    page = 1,
    limit = 20,
  ) {
    await this.assertMinRole(actorId, actorRole, communityId, CommunityRole.MODERATOR);
    return this.listMembers(actorId, actorRole, communityId, page, limit, CommunityMemberStatus.PENDING);
  }

  async reviewRequest(
    actorId: string,
    actorRole: string | undefined,
    communityId: string,
    memberId: string,
    approve: boolean,
  ): Promise<{ success: boolean }> {
    await this.assertMinRole(actorId, actorRole, communityId, CommunityRole.MODERATOR);
    const member = await this.prisma.communityMember.findFirst({
      where: { id: memberId, communityId, status: CommunityMemberStatus.PENDING },
    });
    if (!member) throw new NotFoundException('Pending request not found');

    if (approve) {
      await this.prisma.communityMember.update({
        where: { id: memberId },
        data: { status: CommunityMemberStatus.ACTIVE },
      });
      await this.prisma.community.update({
        where: { id: communityId },
        data: { memberCount: { increment: 1 } },
      });
      const community = await this.prisma.community.findUnique({ where: { id: communityId } });
      await this.notifications.create({
        userId: member.userId,
        type: NotificationType.COMMUNITY_JOIN,
        title: 'Request approved',
        body: `You are now a member of ${community?.name ?? 'the community'}`,
        actorId,
        targetType: 'COMMUNITY',
        targetId: communityId,
        deepLink: community ? `/communities/${community.slug}` : undefined,
      });
    } else {
      await this.prisma.communityMember.delete({ where: { id: memberId } });
    }
    return { success: true };
  }

  async updateMemberRole(
    actorId: string,
    actorRole: string | undefined,
    communityId: string,
    targetUserId: string,
    role: CommunityRole,
  ): Promise<{ success: boolean }> {
    // Changing to/from OWNER requires owner or platform staff.
    const required =
      role === CommunityRole.OWNER ? CommunityRole.OWNER : CommunityRole.ADMIN;
    await this.assertMinRole(actorId, actorRole, communityId, required);

    const community = await this.prisma.community.findFirst({ where: { id: communityId } });
    if (!community) throw new NotFoundException('Community not found');

    const target = await this.prisma.communityMember.findFirst({
      where: { communityId, userId: targetUserId },
    });
    if (!target) throw new NotFoundException('Member not found');

    if (role === CommunityRole.OWNER) {
      // Transfer ownership: demote current owner to ADMIN, promote target.
      await this.prisma.$transaction([
        this.prisma.communityMember.updateMany({
          where: { communityId, userId: community.ownerId },
          data: { role: CommunityRole.ADMIN },
        }),
        this.prisma.communityMember.update({
          where: { id: target.id },
          data: { role: CommunityRole.OWNER },
        }),
        this.prisma.community.update({
          where: { id: communityId },
          data: { ownerId: targetUserId },
        }),
      ]);
    } else {
      if (target.role === CommunityRole.OWNER)
        throw new BadRequestException('Cannot change the owner role directly');
      await this.prisma.communityMember.update({
        where: { id: target.id },
        data: { role: role as CommunityRole },
      });
    }
    return { success: true };
  }

  async updateMemberStatus(
    actorId: string,
    actorRole: string | undefined,
    communityId: string,
    targetUserId: string,
    status: CommunityMemberStatus,
  ): Promise<{ success: boolean }> {
    await this.assertMinRole(actorId, actorRole, communityId, CommunityRole.MODERATOR);
    const target = await this.prisma.communityMember.findFirst({
      where: { communityId, userId: targetUserId },
    });
    if (!target) throw new NotFoundException('Member not found');
    if (target.role === CommunityRole.OWNER)
      throw new ForbiddenException('You cannot moderate the community owner');

    const wasActive = target.status === CommunityMemberStatus.ACTIVE;
    const nowActive = status === CommunityMemberStatus.ACTIVE;
    await this.prisma.communityMember.update({
      where: { id: target.id },
      data: { status: status as CommunityMemberStatus },
    });
    if (wasActive && !nowActive) {
      await this.prisma.community.update({
        where: { id: communityId },
        data: { memberCount: { decrement: 1 } },
      });
    } else if (!wasActive && nowActive) {
      await this.prisma.community.update({
        where: { id: communityId },
        data: { memberCount: { increment: 1 } },
      });
    }
    return { success: true };
  }

  async removeMember(
    actorId: string,
    actorRole: string | undefined,
    communityId: string,
    targetUserId: string,
  ): Promise<{ success: boolean }> {
    // A member may remove themselves; otherwise moderation is required.
    if (actorId !== targetUserId) {
      await this.assertMinRole(actorId, actorRole, communityId, CommunityRole.MODERATOR);
    }
    const target = await this.prisma.communityMember.findFirst({
      where: { communityId, userId: targetUserId },
    });
    if (!target) throw new NotFoundException('Member not found');
    if (target.role === CommunityRole.OWNER && actorId !== targetUserId)
      throw new ForbiddenException('You cannot remove the community owner');

    await this.prisma.communityMember.delete({ where: { id: target.id } });
    if (target.status === CommunityMemberStatus.ACTIVE) {
      await this.prisma.community.update({
        where: { id: communityId },
        data: { memberCount: { decrement: 1 } },
      });
    }
    return { success: true };
  }

  // -------------------------------- Spaces ---------------------------------

  async listSpaces(
    viewerId: string | undefined,
    viewerRole: string | undefined,
    communityId: string,
  ): Promise<ReturnType<typeof toSpaceApi>[]> {
    const community = await this.prisma.community.findFirst({ where: { id: communityId } });
    if (!community) throw new NotFoundException('Community not found');
    await this.ensureCanView(communityId, community.access, viewerId, viewerRole);
    const spaces = await this.prisma.communitySpace.findMany({
      where: { communityId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    return spaces.map((s) => toSpaceApi(s));
  }

  async createSpace(
    actorId: string,
    actorRole: string | undefined,
    communityId: string,
    dto: CreateSpaceDto,
  ): Promise<ReturnType<typeof toSpaceApi>> {
    await this.assertMinRole(actorId, actorRole, communityId, CommunityRole.ADMIN);
    const base = dto.slug ? slugify(dto.slug) : slugify(dto.name);
    const existing = await this.prisma.communitySpace.findUnique({
      where: { communityId_slug: { communityId, slug: base } },
    });
    if (existing) throw new BadRequestException('A space with this slug already exists');

    const space = await this.prisma.communitySpace.create({
      data: {
        communityId,
        name: dto.name,
        slug: base,
        type: (dto.type ?? SpaceType.DISCUSSION) as SpaceType,
        description: dto.description ?? null,
        isPrivate: dto.isPrivate ?? false,
        order: dto.order ?? 0,
      },
    });
    return toSpaceApi(space);
  }

  async updateSpace(
    actorId: string,
    actorRole: string | undefined,
    communityId: string,
    spaceId: string,
    dto: UpdateSpaceDto,
  ): Promise<ReturnType<typeof toSpaceApi>> {
    await this.assertMinRole(actorId, actorRole, communityId, CommunityRole.ADMIN);
    const space = await this.prisma.communitySpace.findFirst({
      where: { id: spaceId, communityId },
    });
    if (!space) throw new NotFoundException('Space not found');
    const updated = await this.prisma.communitySpace.update({
      where: { id: spaceId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.type !== undefined ? { type: dto.type as SpaceType } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.isPrivate !== undefined ? { isPrivate: dto.isPrivate } : {}),
        ...(dto.order !== undefined ? { order: dto.order } : {}),
      },
    });
    return toSpaceApi(updated);
  }

  async deleteSpace(
    actorId: string,
    actorRole: string | undefined,
    communityId: string,
    spaceId: string,
  ): Promise<{ success: boolean }> {
    await this.assertMinRole(actorId, actorRole, communityId, CommunityRole.ADMIN);
    const space = await this.prisma.communitySpace.findFirst({
      where: { id: spaceId, communityId },
    });
    if (!space) throw new NotFoundException('Space not found');
    await this.prisma.communitySpace.delete({ where: { id: spaceId } });
    return { success: true };
  }

  // -------------------------------- Invites --------------------------------

  async inviteMembers(
    actorId: string,
    actorRole: string | undefined,
    communityId: string,
    dto: InviteMembersDto,
  ): Promise<{ invited: number }> {
    await this.assertMinRole(actorId, actorRole, communityId, CommunityRole.MODERATOR);
    const community = await this.prisma.community.findFirst({
      where: { id: communityId, deletedAt: null },
      include: COMMUNITY_INCLUDE,
    });
    if (!community) throw new NotFoundException('Community not found');

    const inviter = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: { displayName: true, username: true },
    });
    const inviterName = inviter?.displayName || inviter?.username || 'A member';
    const role = dto.role ?? CommunityRole.MEMBER;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    let invited = 0;
    for (const email of dto.emails) {
      const clean = email.trim().toLowerCase();
      if (!clean) continue;
      const token = nanoid(32);
      await this.prisma.communityInvite.create({
        data: {
          communityId,
          inviterId: actorId,
          email: clean,
          token,
          role: role as CommunityRole,
          expiresAt,
        },
      });
      await this.mail.sendCommunityInvite(clean, community.name, inviterName, token);
      invited += 1;
    }
    return { invited };
  }

  async acceptInvite(
    userId: string,
    token: string,
  ): Promise<{ communitySlug: string; role: CommunityRole }> {
    const invite = await this.prisma.communityInvite.findUnique({
      where: { token },
      include: { community: true },
    });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.acceptedAt) throw new BadRequestException('Invite already used');
    if (invite.expiresAt && invite.expiresAt < new Date())
      throw new BadRequestException('Invite has expired');
    if (invite.community.deletedAt) throw new NotFoundException('Community not found');

    const existing = await this.getMembership(invite.communityId, userId);
    if (existing && existing.status === CommunityMemberStatus.ACTIVE) {
      await this.prisma.communityInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });
      return { communitySlug: invite.community.slug, role: existing.role as CommunityRole };
    }

    await this.prisma.$transaction([
      existing
        ? this.prisma.communityMember.update({
            where: { id: existing.id },
            data: { status: CommunityMemberStatus.ACTIVE, role: invite.role },
          })
        : this.prisma.communityMember.create({
            data: {
              communityId: invite.communityId,
              userId,
              role: invite.role,
              status: CommunityMemberStatus.ACTIVE,
            },
          }),
      this.prisma.community.update({
        where: { id: invite.communityId },
        data: { memberCount: { increment: existing ? 0 : 1 } },
      }),
      this.prisma.communityInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      }),
    ]);

    return { communitySlug: invite.community.slug, role: invite.role as CommunityRole };
  }
}
