import { User } from '@prisma/client';
import {
  PublicUser,
  UserProfile,
  ProfileVisibility,
  SubscriptionTier,
  UserRole,
  UserStatus,
  ConnectionStatus,
} from '@mehfil/shared';

type UserWithCounts = User & {
  _count?: {
    followsReceived?: number;
    followsInitiated?: number;
  };
};

/** Extra, request-scoped context used to enrich the mapped user. */
export interface UserMapContext {
  skillsOffered?: string[];
  skillsWanted?: string[];
  isFollowing?: boolean;
  connectionStatus?: ConnectionStatus;
  tier?: SubscriptionTier;
}

/** Map a Prisma User to the public representation (safe for any viewer). */
export function toPublicUser(
  user: UserWithCounts,
  ctx: UserMapContext = {},
): PublicUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    city: user.city,
    country: user.country,
    interests: user.interests ?? [],
    followersCount: user._count?.followsReceived ?? 0,
    followingCount: user._count?.followsInitiated ?? 0,
    ...(ctx.isFollowing !== undefined ? { isFollowing: ctx.isFollowing } : {}),
    ...(ctx.connectionStatus !== undefined
      ? { connectionStatus: ctx.connectionStatus }
      : {}),
    ...(ctx.tier ? { tier: ctx.tier } : {}),
  };
}

/** Map a Prisma User to the full profile (only for the owner or admins). */
export function toUserProfile(
  user: UserWithCounts,
  ctx: UserMapContext = {},
): UserProfile {
  const base = toPublicUser(user, ctx);
  return {
    ...base,
    email: user.email,
    phone: user.phone,
    role: user.role as UserRole,
    status: user.status as UserStatus,
    visibility: user.visibility as ProfileVisibility,
    aboutMe: user.aboutMe,
    coverUrl: user.coverUrl,
    location: user.location,
    skillsOffered: ctx.skillsOffered ?? [],
    skillsWanted: ctx.skillsWanted ?? [],
    isVerified: user.isVerified,
    memberSince: user.createdAt.toISOString(),
  };
}

/** Minimal author shape used on posts/comments/messages. */
export function toAuthor(user: Pick<User, 'id' | 'username' | 'displayName' | 'avatarUrl'>) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
  };
}
