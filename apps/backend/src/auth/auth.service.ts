import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import { AuthResponse, MIN_AGE } from '@mehfil/shared';
import { PrismaService } from '../prisma/prisma.service';
import { TokensService } from './tokens.service';
import { MailService } from '../mail/mail.service';
import { toUserProfile } from '../users/user.mapper';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  /** Register a new user. Enforces unique email/username and the age gate. */
  async register(dto: RegisterDto): Promise<AuthResponse> {
    const email = dto.email.toLowerCase().trim();
    const username = dto.username.toLowerCase().trim();

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
      select: { email: true, username: true },
    });
    if (existing?.email === email)
      throw new ConflictException('An account with this email already exists');
    if (existing?.username === username)
      throw new ConflictException('This username is already taken');

    this.assertAgeAllowed(dto.dateOfBirth, dto.acceptedAge);

    const passwordHash = await this.tokens.hashPassword(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email,
        username,
        displayName: dto.displayName.trim(),
        passwordHash,
        phone: dto.phone ?? null,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        ageAcceptedAt: new Date(),
        emailVerified: !this.emailVerificationEnabled(),
        status: this.emailVerificationEnabled() ? 'PENDING_VERIFICATION' : 'ACTIVE',
        subscription: { create: { tier: 'FREE', status: 'ACTIVE' } },
        notificationPref: { create: {} },
      },
    });

    if (this.emailVerificationEnabled()) {
      await this.issueVerificationToken(user);
    }

    this.logger.log(`Registered new user ${user.username} (${user.id})`);
    return this.buildAuthResponse(user);
  }

  /** Login with email/username + password. */
  async login(dto: LoginDto): Promise<AuthResponse> {
    const identifier = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [{ email: identifier }, { username: identifier }],
      },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await this.tokens.verifyPassword(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    if (user.status === 'SUSPENDED' || user.status === 'BANNED')
      throw new UnauthorizedException(`Account is ${user.status.toLowerCase()}`);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
    });

    return this.buildAuthResponse(user);
  }

  async refresh(refreshToken: string, userAgent?: string, ip?: string): Promise<{ tokens: AuthResponse['tokens'] }> {
    const tokens = await this.tokens.rotate(refreshToken, userAgent, ip);
    return { tokens };
  }

  async logout(refreshToken: string): Promise<{ success: boolean }> {
    if (refreshToken) await this.tokens.revoke(refreshToken);
    return { success: true };
  }

  /** Return the current user's profile from an authenticated request. */
  async me(userId: string) {
    const user = await this.prisma.user.findFirstOrThrow({
      where: { id: userId, deletedAt: null },
      include: { _count: { select: { followsReceived: true, followsInitiated: true } }, skills: true },
    });
    return toUserProfile(user, {
      skillsOffered: user.skills.filter((s) => s.relation === 'OFFER').map((s) => s.name),
      skillsWanted: user.skills.filter((s) => s.relation === 'WANT').map((s) => s.name),
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ success: boolean }> {
    const user = await this.prisma.user.findFirstOrThrow({ where: { id: userId } });
    const ok = await this.tokens.verifyPassword(dto.currentPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Current password is incorrect');
    const passwordHash = await this.tokens.hashPassword(dto.newPassword);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.tokens.revokeAllForUser(userId);
    return { success: true };
  }

  /** Kick off a password reset — always returns success to avoid email enumeration. */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ success: boolean }> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findFirst({ where: { email, deletedAt: null } });
    if (user) {
      const { token, tokenHash } = this.tokens.generateOpaqueToken();
      await this.prisma.verificationToken.create({
        data: {
          userId: user.id,
          email,
          purpose: 'PASSWORD_RESET',
          tokenHash,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        },
      });
      await this.mail.sendPasswordReset(email, token);
    }
    return { success: true };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ success: boolean }> {
    const tokenHash = this.tokens.hashToken(dto.token);
    const record = await this.prisma.verificationToken.findUnique({ where: { tokenHash } });
    if (!record || record.purpose !== 'PASSWORD_RESET')
      throw new BadRequestException('Invalid or expired reset token');
    if (record.usedAt) throw new BadRequestException('Reset token already used');
    if (record.expiresAt < new Date())
      throw new BadRequestException('Reset token expired');

    const passwordHash = await this.tokens.hashPassword(dto.password);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId! }, data: { passwordHash } }),
      this.prisma.verificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);
    if (record.userId) await this.tokens.revokeAllForUser(record.userId);
    return { success: true };
  }

  async verifyEmail(token: string): Promise<{ success: boolean }> {
    const tokenHash = this.tokens.hashToken(token);
    const record = await this.prisma.verificationToken.findUnique({ where: { tokenHash } });
    if (!record || record.purpose !== 'EMAIL_VERIFY')
      throw new BadRequestException('Invalid verification token');
    if (record.expiresAt < new Date())
      throw new BadRequestException('Verification token expired');
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId! },
        data: { emailVerified: true, status: 'ACTIVE' },
      }),
      this.prisma.verificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);
    return { success: true };
  }

  async resendVerification(userId: string): Promise<{ success: boolean }> {
    const user = await this.prisma.user.findFirstOrThrow({ where: { id: userId } });
    if (user.emailVerified) throw new BadRequestException('Email already verified');
    await this.issueVerificationToken(user);
    return { success: true };
  }

  /** Soft-delete the account (account deletion requirement). */
  async deleteAccount(userId: string, password: string): Promise<{ success: boolean }> {
    const user = await this.prisma.user.findFirstOrThrow({ where: { id: userId } });
    const ok = await this.tokens.verifyPassword(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Incorrect password');
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { deletedAt: new Date(), status: 'DELETED', emailVerified: false },
      }),
    ]);
    await this.tokens.revokeAllForUser(userId);
    return { success: true };
  }

  // ------------------------------ helpers --------------------------------

  private async issueVerificationToken(user: User): Promise<void> {
    const { token, tokenHash } = this.tokens.generateOpaqueToken();
    await this.prisma.verificationToken.create({
      data: {
        userId: user.id,
        email: user.email,
        purpose: 'EMAIL_VERIFY',
        tokenHash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
      },
    });
    await this.mail.sendVerification(user.email, token);
  }

  private emailVerificationEnabled(): boolean {
    return this.config.get<boolean>('app.features.enableEmailVerification') === true;
  }

  private assertAgeAllowed(dateOfBirth?: string, acceptedAge?: boolean): void {
    const ageGate = this.config.get<boolean>('app.features.enableAgeGate') !== false;
    if (!ageGate) return;
    const minAge = this.config.get<number>('app.features.minAge') || MIN_AGE;
    if (dateOfBirth) {
      const dob = new Date(dateOfBirth);
      const now = new Date();
      let age = now.getFullYear() - dob.getFullYear();
      const m = now.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
      if (age < minAge)
        throw new BadRequestException(`You must be at least ${minAge} years old to join`);
    } else if (!acceptedAge) {
      throw new BadRequestException(`You must confirm you are at least ${minAge} years old`);
    }
  }

  private async buildAuthResponse(user: User): Promise<AuthResponse> {
    const tokens = await this.tokens.issueTokens(user);
    const full = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { _count: { select: { followsReceived: true, followsInitiated: true } }, skills: true },
    });
    return {
      user: toUserProfile(full, {
        skillsOffered: full.skills.filter((s) => s.relation === 'OFFER').map((s) => s.name),
        skillsWanted: full.skills.filter((s) => s.relation === 'WANT').map((s) => s.name),
      }),
      tokens,
    };
  }
}
