/**
 * Shared enums for the Mehfil platform.
 * These are runtime values used by the backend (validation/persistence),
 * the web app, and the mobile app.
 */

export enum UserRole {
  USER = 'USER',
  MODERATOR = 'MODERATOR',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  SUSPENDED = 'SUSPENDED',
  BANNED = 'BANNED',
  DELETED = 'DELETED',
}

export enum ProfileVisibility {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
  MEMBERS_ONLY = 'MEMBERS_ONLY',
}

export enum CommunityAccess {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
  SECRET = 'SECRET',
}

/** Role of a member within a specific community. */
export enum CommunityRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MODERATOR = 'MODERATOR',
  MEMBER = 'MEMBER',
}

export enum CommunityMemberStatus {
  ACTIVE = 'ACTIVE',
  PENDING = 'PENDING',
  MUTED = 'MUTED',
  SUSPENDED = 'SUSPENDED',
  BANNED = 'BANNED',
}

/** A space is a sub-area of a community (Circle-style). */
export enum SpaceType {
  DISCUSSION = 'DISCUSSION',
  ANNOUNCEMENTS = 'ANNOUNCEMENTS',
  EVENTS = 'EVENTS',
  COURSES = 'COURSES',
  CHAT = 'CHAT',
}

export enum PostType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  POLL = 'POLL',
  FILE = 'FILE',
}

export enum PostStatus {
  PUBLISHED = 'PUBLISHED',
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  REMOVED = 'REMOVED',
}

/** Reaction kinds for posts and comments. */
export enum ReactionType {
  LIKE = 'LIKE',
  LOVE = 'LOVE',
  SUPPORT = 'SUPPORT',
  INSIGHTFUL = 'INSIGHTFUL',
  CELEBRATE = 'CELEBRATE',
}

export enum EventType {
  ONLINE = 'ONLINE',
  IN_PERSON = 'IN_PERSON',
  HYBRID = 'HYBRID',
}

export enum EventStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ONGOING = 'ONGOING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum EventRsvpStatus {
  INTERESTED = 'INTERESTED',
  GOING = 'GOING',
  NOT_GOING = 'NOT_GOING',
  WAITLISTED = 'WAITLISTED',
}

export enum TicketType {
  FREE = 'FREE',
  PAID = 'PAID',
  EARLY_BIRD = 'EARLY_BIRD',
  VIP = 'VIP',
  GROUP = 'GROUP',
  INVITE_ONLY = 'INVITE_ONLY',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  HELD = 'HELD',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  CANCELLED = 'CANCELLED',
}

/** Payment method for Phase 1 (mock + manual). */
export enum PaymentMethod {
  MOCK_CARD = 'MOCK_CARD',
  CASH = 'CASH',
  BANK_TRANSFER = 'BANK_TRANSFER',
  JAZZCASH = 'JAZZCASH',
  EASYPAISA = 'EASYPAISA',
  FREE = 'FREE',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  AWAITING_APPROVAL = 'AWAITING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  REFUNDED = 'REFUNDED',
}

export enum TicketStatus {
  VALID = 'VALID',
  USED = 'USED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
  EXPIRED = 'EXPIRED',
}

export enum ConversationType {
  DIRECT = 'DIRECT',
  GROUP = 'GROUP',
}

export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  FILE = 'FILE',
  SYSTEM = 'SYSTEM',
}

export enum NotificationType {
  CONNECTION_REQUEST = 'CONNECTION_REQUEST',
  CONNECTION_ACCEPTED = 'CONNECTION_ACCEPTED',
  NEW_FOLLOWER = 'NEW_FOLLOWER',
  POST_LIKE = 'POST_LIKE',
  POST_COMMENT = 'POST_COMMENT',
  COMMENT_REPLY = 'COMMENT_REPLY',
  MENTION = 'MENTION',
  MESSAGE = 'MESSAGE',
  COMMUNITY_JOIN = 'COMMUNITY_JOIN',
  COMMUNITY_ACTIVITY = 'COMMUNITY_ACTIVITY',
  EVENT_REMINDER = 'EVENT_REMINDER',
  EVENT_UPDATE = 'EVENT_UPDATE',
  TICKET_PURCHASED = 'TICKET_PURCHASED',
  SKILL_REQUEST = 'SKILL_REQUEST',
  SYSTEM = 'SYSTEM',
}

export enum ConnectionStatus {
  NONE = 'NONE',
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  BLOCKED = 'BLOCKED',
}

export enum ReportTargetType {
  USER = 'USER',
  POST = 'POST',
  COMMENT = 'COMMENT',
  COMMUNITY = 'COMMUNITY',
  EVENT = 'EVENT',
  MESSAGE = 'MESSAGE',
}

export enum ReportReason {
  SPAM = 'SPAM',
  HARASSMENT = 'HARASSMENT',
  HATE_SPEECH = 'HATE_SPEECH',
  VIOLENCE = 'VIOLENCE',
  NUDITY = 'NUDITY',
  MISINFORMATION = 'MISINFORMATION',
  SCAM = 'SCAM',
  INAPPROPRIATE_CONTENT = 'INAPPROPRIATE_CONTENT',
  OTHER = 'OTHER',
}

export enum ReportStatus {
  OPEN = 'OPEN',
  IN_REVIEW = 'IN_REVIEW',
  RESOLVED = 'RESOLVED',
  DISMISSED = 'DISMISSED',
}

export enum SubscriptionTier {
  FREE = 'FREE',
  PREMIUM = 'PREMIUM',
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  TRIALING = 'TRIALING',
  PAST_DUE = 'PAST_DUE',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum SkillRelation {
  OFFER = 'OFFER',
  WANT = 'WANT',
}

export enum SkillExchangeStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum MediaKind {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  FILE = 'FILE',
  AVATAR = 'AVATAR',
  COVER = 'COVER',
}

/** Supported locales for Phase 1. */
export enum Locale {
  EN = 'en',
  UR = 'ur',
}
