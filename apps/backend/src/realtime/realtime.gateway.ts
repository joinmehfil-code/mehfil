import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SOCKET_EVENTS } from '@mehfil/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesService } from '../messages/messages.service';
import { JwtPayload } from '../common/types/auth-user.type';

/**
 * RealtimeGateway — single Socket.IO server used for chat, notifications and
 * live counters. Each authenticated socket joins a per-user room `user:<id>`
 * so services can push to a user across all their devices.
 */
@WebSocketGateway({
  namespace: '/rt',
  cors: { origin: true, credentials: true },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly messages: MessagesService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.query?.token as string) ||
        this.bearerFromHeader(client.handshake.headers.authorization);
      if (!token) {
        client.emit('error', { message: 'Authentication required' });
        client.disconnect(true);
        return;
      }
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.get<string>('app.jwt.accessSecret'),
      });
      if (payload.type !== 'access') throw new Error('Invalid token type');

      client.data.userId = payload.sub;
      await client.join(this.userRoom(payload.sub));

      // Mark presence online + persist lastSeen.
      await this.setOnline(payload.sub, true);
      client.emit(SOCKET_EVENTS.CONNECTION_PRESENCE, { online: true });
      this.logger.debug(`Socket connected for user ${payload.sub}`);
    } catch (err) {
      this.logger.warn(`Rejected socket connection: ${(err as Error).message}`);
      client.emit('error', { message: 'Invalid or expired token' });
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const userId = client.data?.userId as string | undefined;
    if (!userId) return;
    // If no other sockets remain for this user, mark offline.
    const sockets = await this.server.in(this.userRoom(userId)).fetchSockets();
    if (sockets.length === 0) {
      await this.setOnline(userId, false);
      this.broadcastPresence(userId, false);
    }
  }

  /** Emit an event to all of a user's connected devices. */
  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server?.to(this.userRoom(userId)).emit(event, payload);
  }

  /** Emit to every socket in a conversation room. */
  emitToConversation(conversationId: string, event: string, payload: unknown): void {
    this.server?.to(this.conversationRoom(conversationId)).emit(event, payload);
  }

  /** Join the acting socket to a conversation room (called via chat gateway). */
  joinConversation(socket: Socket, conversationId: string): void {
    void socket.join(this.conversationRoom(conversationId));
  }

  userRoom(userId: string): string {
    return `user:${userId}`;
  }

  conversationRoom(conversationId: string): string {
    return `conv:${conversationId}`;
  }

  private bearerFromHeader(header?: string): string | null {
    if (!header) return null;
    const [scheme, token] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' ? token : null;
  }

  private async setOnline(userId: string, online: boolean): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: online ? { lastSeenAt: new Date() } : { lastSeenAt: new Date() },
      });
    } catch {
      /* non-critical */
    }
  }

  private broadcastPresence(userId: string, online: boolean): void {
    // Notify followers/contacts currently online (best-effort, small fan-out).
    this.server?.emit(SOCKET_EVENTS.CONNECTION_PRESENCE, { userId, online });
  }

  // --------------------------------- Chat ----------------------------------
  // Delivery is via per-user rooms (every connected socket joins `user:<id>`),
  // which guarantees inbox + open-thread updates across all of a user's devices.

  @SubscribeMessage(SOCKET_EVENTS.MESSAGE_SEND)
  async handleSendMessage(
    client: Socket,
    @MessageBody() payload: { conversationId?: string; recipientId?: string; body?: string; type?: string; media?: { url: string; kind?: string; mimeType?: string }[] },
  ): Promise<{ ok: boolean; data?: unknown; error?: string }> {
    const userId = client.data?.userId as string | undefined;
    if (!userId) return { ok: false, error: 'Unauthenticated' };
    try {
      const result = await this.messages.sendMessage(userId, payload as never);
      for (const pid of result.participantIds) {
        this.emitToUser(pid, SOCKET_EVENTS.MESSAGE_NEW, {
          conversationId: result.conversationId,
          message: result.message,
        });
      }
      return { ok: true, data: result.message };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.MESSAGE_READ)
  async handleMarkRead(
    client: Socket,
    @MessageBody() payload: { conversationId: string },
  ): Promise<{ ok: boolean; error?: string }> {
    const userId = client.data?.userId as string | undefined;
    if (!userId || !payload?.conversationId) return { ok: false, error: 'Invalid payload' };
    try {
      const res = await this.messages.markRead(userId, payload.conversationId);
      const participants = await this.messages.getParticipantIds(payload.conversationId);
      for (const pid of participants) {
        if (pid !== userId) this.emitToUser(pid, SOCKET_EVENTS.MESSAGE_READ, res);
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.MESSAGE_TYPING)
  async handleTyping(
    client: Socket,
    @MessageBody() payload: { conversationId: string; isTyping?: boolean },
  ): Promise<void> {
    const userId = client.data?.userId as string | undefined;
    if (!userId || !payload?.conversationId) return;
    const participants = await this.messages.getParticipantIds(payload.conversationId);
    for (const pid of participants) {
      if (pid !== userId)
        this.emitToUser(pid, SOCKET_EVENTS.MESSAGE_TYPING, {
          conversationId: payload.conversationId,
          userId,
          isTyping: payload.isTyping ?? true,
        });
    }
  }
}
