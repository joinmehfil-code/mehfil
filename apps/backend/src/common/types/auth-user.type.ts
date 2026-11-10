import { UserRole } from '@mehfil/shared';

/**
 * Shape of the authenticated user attached to the request by the JWT strategy.
 * Kept intentionally small — full profile is fetched on demand.
 */
export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  status: string;
}

/** JWT access-token payload. */
export interface JwtPayload {
  sub: string;
  email: string;
  username: string;
  role: UserRole;
  status: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}
