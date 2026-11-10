/**
 * Shared TypeScript types / API contracts for the Mehfil platform.
 * These are compile-time only shapes used by web + mobile to talk to the backend.
 */

import {
  CommunityAccess,
  CommunityRole,
  ConnectionStatus,
  ConversationType,
  EventStatus,
  EventType,
  EventRsvpStatus,
  MessageType,
  NotificationType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PostStatus,
  PostType,
  ProfileVisibility,
  ReactionType,
  SubscriptionTier,
  TicketStatus,
  TicketType,
  UserRole,
  UserStatus,
} from './enums';

/* ---------------------------------- Common --------------------------------- */

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
}

export interface IdTimestamps {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

/* ---------------------------------- Users ---------------------------------- */

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  city: string | null;
  country: string | null;
  interests: string[];
  followersCount: number;
  followingCount: number;
  isFollowing?: boolean;
  connectionStatus?: ConnectionStatus;
  tier?: SubscriptionTier;
}

export interface UserProfile extends PublicUser {
  email?: string;
  phone?: string | null;
  role: UserRole;
  status: UserStatus;
  visibility: ProfileVisibility;
  aboutMe: string | null;
  coverUrl: string | null;
  location: string | null;
  skillsOffered: string[];
  skillsWanted: string[];
  isVerified: boolean;
  memberSince: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface AuthResponse {
  user: UserProfile;
  tokens: AuthTokens;
}

/* ---------------------------------- Posts ---------------------------------- */

export interface MediaAttachment {
  id: string;
  url: string;
  kind: 'IMAGE' | 'VIDEO' | 'FILE';
  mimeType?: string;
  width?: number;
  height?: number;
  thumbnailUrl?: string | null;
}

export interface PollOption {
  id: string;
  text: string;
  votes: number;
  votedByMe?: boolean;
}

export interface PostAuthor {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface Post extends IdTimestamps {
  author: PostAuthor;
  type: PostType;
  status: PostStatus;
  content: string | null;
  media: MediaAttachment[];
  poll?: { id: string; question: string; options: PollOption[]; endsAt?: string | null } | null;
  communityId?: string | null;
  community?: { id: string; name: string; slug: string } | null;
  spaceId?: string | null;
  eventId?: string | null;
  isPinned: boolean;
  hashtags: string[];
  mentions: string[];
  likeCount: number;
  commentCount: number;
  shareCount: number;
  myReaction?: ReactionType | null;
  canEdit?: boolean;
  canDelete?: boolean;
}

export interface Comment extends IdTimestamps {
  author: PostAuthor;
  postId: string;
  parentId: string | null;
  content: string;
  likeCount: number;
  myReaction?: ReactionType | null;
  replies?: Comment[];
}

/* -------------------------------- Communities ------------------------------ */

export interface Community extends IdTimestamps {
  name: string;
  slug: string;
  description: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  access: CommunityAccess;
  category: string | null;
  city: string | null;
  country: string | null;
  memberCount: number;
  isMember?: boolean;
  myRole?: CommunityRole | null;
  owner?: PostAuthor;
}

export interface CommunitySpace extends IdTimestamps {
  communityId: string;
  name: string;
  slug: string;
  type: 'DISCUSSION' | 'ANNOUNCEMENTS' | 'EVENTS' | 'COURSES' | 'CHAT';
  description: string | null;
  isPrivate: boolean;
  order: number;
}

export interface CommunityMember {
  user: PublicUser;
  role: CommunityRole;
  status: 'ACTIVE' | 'PENDING' | 'MUTED' | 'SUSPENDED' | 'BANNED';
  joinedAt: string;
}

/* ---------------------------------- Events --------------------------------- */

export interface Venue {
  name: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  location?: GeoPoint | null;
  mapUrl?: string | null;
}

export interface EventSummary extends IdTimestamps {
  title: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  type: EventType;
  status: EventStatus;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  isOnline: boolean;
  venue: Venue | null;
  communityId: string | null;
  organizer: PostAuthor;
  attendeeCount: number;
  ticketCount: number;
  priceMin: number | null;
  currency: string;
  myRsvp?: EventRsvpStatus | null;
}

export interface TicketTier {
  id: string;
  name: string;
  description: string | null;
  type: TicketType;
  price: number;
  currency: string;
  quantityTotal: number;
  quantitySold: number;
  quantityAvailable: number;
  saleStartsAt: string | null;
  saleEndsAt: string | null;
  minPerOrder: number;
  maxPerOrder: number;
}

export interface EventDetail extends EventSummary {
  tickets: TicketTier[];
  isSoldOut: boolean;
  hasWaitlist: boolean;
  onlineUrl?: string | null;
  refundPolicy?: string | null;
}

/* --------------------------------- Ticketing ------------------------------- */

export interface OrderLine {
  id: string;
  ticketTierId: string;
  ticketTierName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Order extends IdTimestamps {
  code: string;
  eventId: string;
  eventTitle: string;
  buyerId: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  subtotal: number;
  discount: number;
  platformFee: number;
  total: number;
  currency: string;
  promoCode: string | null;
  lines: OrderLine[];
  tickets: ETicket[];
}

export interface ETicket extends IdTimestamps {
  orderId: string;
  eventId: string;
  eventTitle: string;
  ticketTierName: string;
  code: string;
  qrPayload: string;
  status: TicketStatus;
  attendeeName: string | null;
  attendeeEmail: string | null;
  checkedInAt: string | null;
}

export interface CheckInResult {
  success: boolean;
  ticket?: ETicket;
  message: string;
  alreadyUsed?: boolean;
  eventTitle?: string;
}

/* -------------------------------- Messaging -------------------------------- */

export interface ConversationParticipant {
  user: PostAuthor;
  lastReadAt: string | null;
}

export interface Conversation extends IdTimestamps {
  type: ConversationType;
  title: string | null;
  participants: ConversationParticipant[];
  lastMessage: Message | null;
  unreadCount: number;
}

export interface Message extends IdTimestamps {
  conversationId: string;
  senderId: string;
  sender?: PostAuthor;
  type: MessageType;
  body: string | null;
  media: MediaAttachment[];
  readBy: string[];
  deletedAt: string | null;
}

/* ------------------------------ Notifications ------------------------------ */

export interface AppNotification extends IdTimestamps {
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  actor?: PostAuthor | null;
  targetType: string | null;
  targetId: string | null;
  deepLink: string | null;
  data?: Record<string, unknown>;
}

/* ------------------------------ Skill exchange ----------------------------- */

export interface SkillExchangeRequest extends IdTimestamps {
  fromUser: PublicUser;
  toUser: PublicUser;
  offeredSkill: string;
  wantedSkill: string;
  message: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'COMPLETED' | 'CANCELLED';
}

/* ---------------------------------- Admin ---------------------------------- */

export interface AdminStats {
  users: { total: number; active: number; newToday: number; newThisWeek: number };
  communities: { total: number; newThisWeek: number };
  events: { total: number; upcoming: number; completed: number };
  posts: { total: number; newToday: number };
  orders: { total: number; paid: number; revenue: number; currency: string };
  tickets: { sold: number; checkedIn: number };
  reports: { open: number; resolved: number };
  messages: { total: number };
}
