import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserStatus, UserRole } from '@mehfil/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser, JwtPayload } from '../common/types/auth-user.type';

/**
 * JWT strategy — validates the access token and loads a fresh, minimal user.
 * Rejects suspended/banned/deleted accounts at request time.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('app.jwt.accessSecret')!,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, username: true, role: true, status: true },
    });
    if (!user) throw new UnauthorizedException('User no longer exists');
    if (
      user.status === UserStatus.SUSPENDED ||
      user.status === UserStatus.BANNED ||
      user.status === UserStatus.DELETED
    ) {
      throw new UnauthorizedException(`Account is ${user.status.toLowerCase()}`);
    }
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role as UserRole,
      status: user.status,
    };
  }
}
