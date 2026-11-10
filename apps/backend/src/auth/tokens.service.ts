import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { User } from '@prisma/client';
import { AuthTokens, UserRole } from '@mehfil/shared';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../common/types/auth-user.type';

/**
 * Issues access tokens (short-lived JWT) and refresh tokens
 * (opaque random strings stored hashed in the DB, rotated on use).
 */
@Injectable()
export class TokensService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private accessExpiresInSeconds(): number {
    const raw = this.config.get<string>('app.jwt.accessExpiresIn') || '15m';
    const match = raw.match(/^(\d+)([smhd])$/);
    if (!match) return 900;
    const n = parseInt(match[1], 10);
    const unit = match[2];
    const mult = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
    return n * mult;
  }

  async issueTokens(user: User): Promise<AuthTokens> {
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.role as UserRole,
      status: user.status,
      type: 'access',
    };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('app.jwt.accessSecret'),
      expiresIn: this.config.get<string>('app.jwt.accessExpiresIn'),
    });

    const refreshToken = randomBytes(48).toString('base64url');
    const refreshExpiresIn = this.config.get<string>('app.jwt.refreshExpiresIn') || '30d';
    const expiresAt = this.addDuration(new Date(), refreshExpiresIn);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.sha256(refreshToken),
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessExpiresInSeconds(),
      tokenType: 'Bearer',
    };
  }

  /**
   * Rotate a refresh token: validate + revoke the old one, issue a new pair.
   */
  async rotate(refreshToken: string, userAgent?: string, ip?: string): Promise<AuthTokens> {
    const tokenHash = this.sha256(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!stored) throw new UnauthorizedException('Invalid refresh token');
    if (stored.revokedAt) throw new UnauthorizedException('Refresh token revoked');
    if (stored.expiresAt < new Date())
      throw new UnauthorizedException('Refresh token expired');

    // Revoke the used token.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issueTokens(stored.user);
    // Link rotation chain for auditability.
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.sha256(tokens.refreshToken) },
      data: { replacedById: stored.id, userAgent, ip },
    });
    return tokens;
  }

  async revoke(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.sha256(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Generate a random opaque token + its hash for email verification / password reset. */
  generateOpaqueToken(): { token: string; tokenHash: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, tokenHash: this.sha256(token) };
  }

  hashToken(token: string): string {
    return this.sha256(token);
  }

  async hashPassword(plain: string): Promise<string> {
    const rounds = this.config.get<number>('app.bcryptSaltRounds') || 10;
    return bcrypt.hash(plain, rounds);
  }

  async verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  private addDuration(from: Date, duration: string): Date {
    const match = duration.match(/^(\d+)([smhd])$/);
    const d = new Date(from);
    if (!match) {
      d.setDate(d.getDate() + 30);
      return d;
    }
    const n = parseInt(match[1], 10);
    const unit = match[2];
    if (unit === 's') d.setSeconds(d.getSeconds() + n);
    else if (unit === 'm') d.setMinutes(d.getMinutes() + n);
    else if (unit === 'h') d.setHours(d.getHours() + n);
    else d.setDate(d.getDate() + n);
    return d;
  }
}
