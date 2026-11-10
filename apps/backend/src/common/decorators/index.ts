import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { AuthUser } from '../types/auth-user.type';

/** Key used to mark a route as public (no JWT required). */
export const IS_PUBLIC_KEY = 'isPublic';
/** Decorator: mark a route as publicly accessible (skips JwtAuthGuard). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Key used to store required roles on a route handler. */
export const ROLES_KEY = 'roles';
/** Decorator: restrict a route to specific user roles. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Param decorator: inject the authenticated user (or a single field of it).
 * Usage: `@CurrentUser() user: AuthUser` or `@CurrentUser('id') userId: string`.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;
    if (!user) return undefined;
    return data ? user[data] : user;
  },
);
