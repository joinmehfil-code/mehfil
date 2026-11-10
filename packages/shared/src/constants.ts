/**
 * Shared constants for the Mehfil platform.
 */

export const PLATFORM = {
  name: 'Mehfil',
  tagline: 'Discover people, communities, events and skills.',
  domain: 'joinmehfil.co',
  supportEmail: 'support@joinmehfil.co',
  noReplyEmail: 'no-reply@joinmehfil.co',
  apiUrl: 'https://api.joinmehfil.co',
  webUrl: 'https://joinmehfil.co',
} as const;

/** Minimum age required to register (COPPA / app-store compliance). */
export const MIN_AGE = 13;

/** Pagination defaults. */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

/** Ticket hold duration during checkout (seconds). */
export const TICKET_HOLD_SECONDS = 600; // 10 minutes

/** Platform commission on ticket sales (Phase 1 default). */
export const PLATFORM_FEE_PERCENT = 5;

/** Event reminder offsets (minutes before start). */
export const EVENT_REMINDER_OFFSETS_MIN = [1440, 60, 15] as const;

/** Upload limits (bytes). */
export const UPLOAD_LIMITS = {
  IMAGE: 8 * 1024 * 1024, // 8 MB
  VIDEO: 200 * 1024 * 1024, // 200 MB
  FILE: 25 * 1024 * 1024, // 25 MB
  AVATAR: 4 * 1024 * 1024, // 4 MB
} as const;

/** Content categories used for discovery and filtering. */
export const CATEGORIES = [
  'Technology',
  'Business & Startup',
  'Education',
  'Arts & Culture',
  'Music',
  'Poetry & Literature',
  'Sports & Fitness',
  'Health & Wellness',
  'Food & Cooking',
  'Travel',
  'Photography',
  'Gaming',
  'Fashion',
  'Science',
  'Faith & Spirituality',
  'Social Impact',
  'Career & Jobs',
  'Parenting & Family',
] as const;

/** Example interests/skills for onboarding suggestions. */
export const INTERESTS = [
  'Reading',
  'Writing',
  'Public Speaking',
  'Programming',
  'Design',
  'Marketing',
  'Photography',
  'Video Editing',
  'Cooking',
  'Fitness',
  'Cricket',
  'Football',
  'Music',
  'Singing',
  'Guitar',
  'Poetry',
  'Painting',
  'Calligraphy',
  'Language Learning',
  'Mentoring',
  'Entrepreneurship',
  'Investing',
  'Yoga',
  'Hiking',
  'Gaming',
] as const;

/** Supported currencies (Phase 1: PKR primary). */
export const CURRENCIES = ['PKR', 'USD'] as const;
export const DEFAULT_CURRENCY = 'PKR';

/** Report reasons human labels (English). */
export const REPORT_REASON_LABELS: Record<string, string> = {
  SPAM: 'Spam or misleading',
  HARASSMENT: 'Harassment or bullying',
  HATE_SPEECH: 'Hate speech',
  VIOLENCE: 'Violence or dangerous content',
  NUDITY: 'Nudity or sexual content',
  MISINFORMATION: 'Misinformation',
  SCAM: 'Scam or fraud',
  INAPPROPRIATE_CONTENT: 'Inappropriate content',
  OTHER: 'Something else',
};

/** Socket.IO event names shared between backend and clients. */
export const SOCKET_EVENTS = {
  // Connection
  CONNECTION_REGISTER: 'connection:register',
  CONNECTION_PRESENCE: 'connection:presence',
  // Chat
  MESSAGE_SEND: 'message:send',
  MESSAGE_NEW: 'message:new',
  MESSAGE_READ: 'message:read',
  MESSAGE_TYPING: 'message:typing',
  MESSAGE_DELETED: 'message:deleted',
  // Notifications
  NOTIFICATION_NEW: 'notification:new',
  NOTIFICATION_READ: 'notification:read',
  // Live counters
  EVENT_ATTENDEE_UPDATE: 'event:attendee_update',
  CHECKIN_UPDATE: 'checkin:update',
} as const;

/** Route name constants for navigation consistency across apps. */
export const NAV = {
  HOME: 'home',
  DISCOVER: 'discover',
  COMMUNITIES: 'communities',
  EVENTS: 'events',
  MESSAGES: 'messages',
  NOTIFICATIONS: 'notifications',
  PROFILE: 'profile',
  TICKETS: 'tickets',
} as const;
