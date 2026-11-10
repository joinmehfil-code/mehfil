import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@mehfil/shared';
import { ROLES_KEY } from '../decorators';
import { AuthUser } from '../types/auth-user.type';

/** Role hierarchy — higher index = more privilege. */
const ROLE_RANK: Record<string, number> = {
  USER: 0,
  MODERATOR: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

/**
 * Guard that enforces @Roles(...) metadata.
 * A user passes if their role is explicitly listed OR outranks the highest required role.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!user) throw new ForbiddenException('Authentication required');

    if (required.includes(user.role)) return true;

    const highestRequired = Math.max(
      ...required.map((r) => ROLE_RANK[r] ?? 0),
    );
    const userRank = ROLE_RANK[user.role] ?? 0;
    if (userRank >= highestRequired) return true;

    throw new ForbiddenException('You do not have permission to perform this action');
  }
}

/** Convenience re-export so controllers can reference the enum without extra import. */
export { UserRole };
