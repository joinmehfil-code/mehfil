/**
 * Typed API service layer for mobile — one namespace per backend module.
 * Mirrors the web services so both platforms share identical contracts.
 */
import type {
  AdminStats,
  AppNotification,
  CheckInResult,
  Comment,
  Community,
  CommunityMember,
  CommunitySpace,
  Conversation,
  ETicket,
  EventDetail,
  EventSummary,
  Message,
  Order,
  Paginated,
  Post,
  PublicUser,
  UserProfile,
} from '@mehfil/shared';
import { api, http } from './api';

/** A skill row as returned by GET /users/me/skills. */
export interface SkillRow {
  name: string;
  relation: 'OFFER' | 'WANT';
  level?: string | null;
}

/* ---------------------------------- Users --------------------------------- */

export interface PeopleQuery {
  q?: string;
  city?: string;
  skill?: string;
  page?: number;
  limit?: number;
}

export const usersApi = {
  me: () => http.get<UserProfile>('/users/me'),
  updateMe: (data: Partial<UserProfile>) => http.put<UserProfile>('/users/me', data),
  suggestions: (limit = 10) => http.get<PublicUser[]>('/users/suggestions', { query: { limit } }),
  search: (q: PeopleQuery) => http.get<Paginated<PublicUser>>('/users/search', { query: { ...q } }),
  bySkill: (skill: string, limit = 20) =>
    http.get<PublicUser[]>('/users/by-skill', { query: { skill, limit } }),
  profile: (identifier: string) => http.get<UserProfile>(`/users/${identifier}`),
  follow: (id: string) => http.post(`/users/${id}/follow`),
  unfollow: (id: string) => http.delete(`/users/${id}/follow`),
  block: (id: string) => http.post(`/users/${id}/block`),
  unblock: (id: string) => http.delete(`/users/${id}/block`),
  followers: (id: string, page = 1, limit = 20) =>
    http.get<Paginated<PublicUser>>(`/users/${id}/followers`, { query: { page, limit } }),
  following: (id: string, page = 1, limit = 20) =>
    http.get<Paginated<PublicUser>>(`/users/${id}/following`, { query: { page, limit } }),
  mySkills: () => http.get<SkillRow[]>('/users/me/skills'),
  addSkill: (name: string, relation: 'OFFER' | 'WANT', level?: string) =>
    http.post('/users/me/skills', { name, relation, level }),
  removeSkill: (name: string, relation: 'OFFER' | 'WANT') =>
    api('/users/me/skills', { method: 'DELETE', body: { name, relation } }),
};

/* ---------------------------------- Posts --------------------------------- */

export interface CreatePostInput {
  content?: string;
  type?: string;
  mediaIds?: string[];
  communityId?: string;
  spaceId?: string;
  eventId?: string;
  poll?: { question: string; options: string[]; endsAt?: string };
}

export const postsApi = {
  feed: (page = 1, limit = 20) => http.get<Paginated<Post>>('/posts/feed', { query: { page, limit } }),
  trending: (page = 1, limit = 20) => http.get<Paginated<Post>>('/posts/trending', { query: { page, limit } }),
  bookmarks: (page = 1, limit = 20) => http.get<Paginated<Post>>('/posts/bookmarks', { query: { page, limit } }),
  byHashtag: (tag: string, page = 1, limit = 20) =>
    http.get<Paginated<Post>>(`/posts/hashtag/${encodeURIComponent(tag)}`, { query: { page, limit } }),
  byUser: (userId: string, page = 1, limit = 20) =>
    http.get<Paginated<Post>>(`/posts/user/${userId}`, { query: { page, limit } }),
  byCommunity: (communityId: string, page = 1, limit = 20, spaceId?: string) =>
    http.get<Paginated<Post>>(`/posts/community/${communityId}`, { query: { page, limit, spaceId } }),
  get: (id: string) => http.get<Post>(`/posts/${id}`),
  create: (data: CreatePostInput) => http.post<Post>('/posts', data),
  update: (id: string, data: Partial<CreatePostInput>) => http.put<Post>(`/posts/${id}`, data),
  remove: (id: string) => http.delete(`/posts/${id}`),
  react: (id: string, type = 'LIKE') => http.post(`/posts/${id}/reactions`, { type }),
  unreact: (id: string) => http.delete(`/posts/${id}/reactions`),
  comments: (id: string, limit = 50) => http.get<Comment[]>(`/posts/${id}/comments`, { query: { limit } }),
  addComment: (id: string, content: string, parentId?: string) =>
    http.post<Comment>(`/posts/${id}/comments`, { content, parentId }),
  votePoll: (optionId: string) => http.post(`/posts/poll/${optionId}/vote`),
  bookmark: (id: string) => http.post(`/posts/${id}/bookmark`),
  share: (id: string) => http.post(`/posts/${id}/share`),
  deleteComment: (id: string) => http.delete(`/comments/${id}`),
};

/* ------------------------------- Communities ------------------------------ */

export const communitiesApi = {
  discover: (q: { search?: string; category?: string; page?: number; limit?: number } = {}) =>
    http.get<Paginated<Community>>('/communities/discover', { query: q }),
  mine: (page = 1, limit = 20) => http.get<Paginated<Community>>('/communities/mine', { query: { page, limit } }),
  get: (idOrSlug: string) => http.get<Community>(`/communities/${idOrSlug}`),
  create: (data: { name: string; description?: string; access?: string; category?: string }) =>
    http.post<Community>('/communities', data),
  join: (id: string) => http.post(`/communities/${id}/join`),
  leave: (id: string) => http.post(`/communities/${id}/leave`),
  members: (id: string, page = 1, limit = 20) =>
    http.get<Paginated<CommunityMember>>(`/communities/${id}/members`, { query: { page, limit } }),
  spaces: (id: string) => http.get<CommunitySpace[]>(`/communities/${id}/spaces`),
};

/* ---------------------------------- Events -------------------------------- */

export const eventsApi = {
  discover: (q: { search?: string; when?: string; city?: string; page?: number; limit?: number } = {}) =>
    http.get<Paginated<EventSummary>>('/events/discover', { query: q }),
  mine: (page = 1, limit = 20) => http.get<Paginated<EventSummary>>('/events/mine', { query: { page, limit } }),
  attending: (page = 1, limit = 20) =>
    http.get<Paginated<EventSummary>>('/events/attending', { query: { page, limit } }),
  get: (idOrSlug: string) => http.get<EventDetail>(`/events/${idOrSlug}`),
  create: (data: Record<string, unknown>) => http.post<EventDetail>('/events', data),
  rsvp: (id: string, status: string) => http.post(`/events/${id}/rsvp`, { status }),
  addTier: (id: string, data: Record<string, unknown>) => http.post(`/events/${id}/tiers`, data),
};

/* -------------------------------- Ticketing ------------------------------- */

export interface CheckoutInput {
  items: { ticketTierId: string; quantity: number }[];
  paymentMethod: string;
  promoCode?: string;
  attendees?: { name?: string; email?: string }[];
}

export const ticketingApi = {
  checkout: (eventId: string, data: CheckoutInput) => http.post<Order>(`/events/${eventId}/checkout`, data),
  checkIn: (eventId: string, code: string, method = 'QR') =>
    http.post<CheckInResult>(`/events/${eventId}/checkin`, { code }, { query: { method } }),
  eventTickets: (eventId: string, page = 1, limit = 20) =>
    http.get<Paginated<ETicket>>(`/events/${eventId}/tickets`, { query: { page, limit } }),
};

export const ordersApi = {
  mine: (page = 1, limit = 20) => http.get<Paginated<Order>>('/orders/mine', { query: { page, limit } }),
  cancel: (id: string) => http.post(`/orders/${id}/cancel`),
  requestRefund: (id: string, reason: string) => http.post(`/orders/${id}/refund`, { reason }),
};

export const ticketsApi = {
  mine: (page = 1, limit = 20) => http.get<Paginated<ETicket>>('/tickets/mine', { query: { page, limit } }),
  qr: (id: string) => http.get<{ qr: string; code: string }>(`/tickets/${id}/qr`),
};

/* -------------------------------- Messaging ------------------------------- */

export const messagesApi = {
  conversations: (page = 1, limit = 20) =>
    http.get<Paginated<Conversation>>('/conversations', { query: { page, limit } }),
  start: (data: { type?: string; recipientId?: string; participantIds?: string[]; title?: string }) =>
    http.post<Conversation>('/conversations', data),
  conversation: (id: string) => http.get<Conversation>(`/conversations/${id}`),
  messages: (id: string, page = 1, limit = 50) =>
    http.get<Paginated<Message>>(`/conversations/${id}/messages`, { query: { page, limit } }),
  send: (id: string, body: string, media?: unknown[]) =>
    http.post<Message>(`/conversations/${id}/messages`, { body, media }),
  markRead: (id: string) => http.post(`/conversations/${id}/read`),
};

/* ------------------------------ Notifications ----------------------------- */

export const notificationsApi = {
  list: (page = 1, limit = 20, unreadOnly = false) =>
    http.get<Paginated<AppNotification>>('/notifications', { query: { page, limit, unreadOnly } }),
  unreadCount: () => http.get<{ count: number }>('/notifications/unread-count'),
  markAllRead: () => http.post('/notifications/read-all'),
  markRead: (id: string) => http.post(`/notifications/${id}/read`),
};

/* --------------------------------- Reports -------------------------------- */

export const reportsApi = {
  create: (data: { targetType: string; targetId: string; reason: string; details?: string }) =>
    http.post('/reports', data),
};

/* ---------------------------------- Admin --------------------------------- */

export const adminApi = {
  stats: () => http.get<AdminStats>('/admin/stats'),
};
