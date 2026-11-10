import { Prisma } from '@prisma/client';
import {
  Community as CommunityApi,
  CommunitySpace as CommunitySpaceApi,
  CommunityMember as CommunityMemberApi,
  CommunityAccess,
  CommunityRole,
  CommunityMemberStatus,
  SpaceType,
} from '@mehfil/shared';
import { toAuthor, toPublicUser } from '../users/user.mapper';

/** Canonical include for community queries — the API type derives from it. */
export const COMMUNITY_INCLUDE = {
  owner: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
} satisfies Prisma.CommunityInclude;

export type CommunityWithRelations = Prisma.CommunityGetPayload<{
  include: typeof COMMUNITY_INCLUDE;
}>;

export function toCommunityApi(
  c: CommunityWithRelations,
  viewer?: { id: string; role?: CommunityRole | string | null } | null,
): CommunityApi {
  return {
    id: c.id,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    name: c.name,
    slug: c.slug,
    description: c.description,
    avatarUrl: c.avatarUrl,
    coverUrl: c.coverUrl,
    access: c.access as CommunityAccess,
    category: c.category,
    city: c.city,
    country: c.country,
    memberCount: c.memberCount,
    owner: toAuthor(c.owner),
    ...(viewer ? { isMember: !!viewer.role, myRole: (viewer.role as CommunityRole) ?? null } : {}),
  };
}

export function toSpaceApi(s: {
  id: string;
  communityId: string;
  name: string;
  slug: string;
  type: SpaceType | string;
  description: string | null;
  isPrivate: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}): CommunitySpaceApi {
  return {
    id: s.id,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    communityId: s.communityId,
    name: s.name,
    slug: s.slug,
    type: s.type as CommunitySpaceApi['type'],
    description: s.description,
    isPrivate: s.isPrivate,
    order: s.order,
  };
}

type MemberRow = {
  role: CommunityRole | string;
  status: CommunityMemberStatus | string;
  joinedAt: Date;
  user: Prisma.UserGetPayload<{ select: Record<string, boolean> }>;
};

export function toMemberApi(m: MemberRow): CommunityMemberApi {
  return {
    user: toPublicUser(m.user as never),
    role: m.role as CommunityRole,
    status: m.status as CommunityMemberApi['status'],
    joinedAt: m.joinedAt.toISOString(),
  };
}
