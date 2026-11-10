import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { PLATFORM } from '@mehfil/shared';

export interface MailPayload {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

/**
 * MailService — sends transactional email.
 * In development (MAIL_DRIVER=log) it logs to the console instead of sending,
 * so no SMTP credentials are required to run locally.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly driver: string;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    this.driver = this.config.get<string>('app.mail.driver') || 'log';
    this.from = this.config.get<string>('app.mail.from') || PLATFORM.noReplyEmail;
    if (this.driver === 'smtp') {
      this.transporter = nodemailer.createTransport({
        host: this.config.get<string>('app.mail.host'),
        port: this.config.get<number>('app.mail.port'),
        secure: this.config.get<boolean>('app.mail.secure'),
        auth: {
          user: this.config.get<string>('app.mail.user'),
          pass: this.config.get<string>('app.mail.password'),
        },
      });
    }
  }

  async send(payload: MailPayload): Promise<boolean> {
    if (this.driver !== 'smtp' || !this.transporter) {
      this.logger.log(
        `[MAIL:log] to=${payload.to} subject="${payload.subject}"\n${payload.text ?? ''}`,
      );
      return true;
    }
    try {
      await this.transporter.sendMail({ from: this.from, ...payload });
      return true;
    } catch (err) {
      this.logger.error(`Failed to send mail to ${payload.to}`, err as Error);
      return false;
    }
  }

  /** Verification email with a link containing the token. */
  async sendVerification(to: string, token: string): Promise<boolean> {
    const webUrl = this.config.get<string>('app.webUrl');
    const link = `${webUrl}/verify-email?token=${encodeURIComponent(token)}`;
    return this.send({
      to,
      subject: `Verify your ${PLATFORM.name} email`,
      text: `Welcome to ${PLATFORM.name}! Verify your email to continue: ${link}`,
      html: this.wrap(
        'Verify your email',
        `<p>Welcome to ${PLATFORM.name}. Click the button below to verify your email address.</p>`,
        link,
        'Verify Email',
      ),
    });
  }

  /** Password reset email with a link containing the token. */
  async sendPasswordReset(to: string, token: string): Promise<boolean> {
    const webUrl = this.config.get<string>('app.webUrl');
    const link = `${webUrl}/reset-password?token=${encodeURIComponent(token)}`;
    return this.send({
      to,
      subject: `Reset your ${PLATFORM.name} password`,
      text: `You requested a password reset. Use this link: ${link}`,
      html: this.wrap(
        'Reset your password',
        '<p>You requested a password reset. Click the button below to choose a new password. If you did not request this, you can safely ignore this email.</p>',
        link,
        'Reset Password',
      ),
    });
  }

  /** Community invitation email with an accept link containing the token. */
  async sendCommunityInvite(
    to: string,
    communityName: string,
    inviterName: string,
    token: string,
  ): Promise<boolean> {
    const webUrl = this.config.get<string>('app.webUrl');
    const link = `${webUrl}/invites/${encodeURIComponent(token)}`;
    return this.send({
      to,
      subject: `${inviterName} invited you to join ${communityName} on ${PLATFORM.name}`,
      text: `${inviterName} invited you to join "${communityName}". Accept here: ${link}`,
      html: this.wrap(
        'You’re invited',
        `<p><strong>${inviterName}</strong> invited you to join <strong>${communityName}</strong> on ${PLATFORM.name}.</p>`,
        link,
        'Accept Invite',
      ),
    });
  }

  /** Simple branded HTML wrapper with a CTA button. */
  private wrap(title: string, body: string, link: string, cta: string): string {
    return `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;background:#f6f7f9;padding:24px;">
      <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
        <div style="background:#6d28d9;color:#fff;padding:20px 24px;font-size:20px;font-weight:700;">${PLATFORM.name}</div>
        <div style="padding:24px;">
          <h2 style="margin-top:0;color:#111827;">${title}</h2>
          ${body}
          <p style="margin:24px 0;">
            <a href="${link}" style="background:#6d28d9;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;">${cta}</a>
          </p>
          <p style="color:#6b7280;font-size:12px;word-break:break-all;">Or copy this link: ${link}</p>
        </div>
        <div style="padding:16px 24px;color:#9ca3af;font-size:12px;border-top:1px solid #f0f0f0;">
          &copy; ${new Date().getFullYear()} ${PLATFORM.name} &middot; ${PLATFORM.domain}
        </div>
      </div>
    </body></html>`;
  }
}
