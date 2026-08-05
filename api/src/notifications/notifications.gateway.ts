import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { NotificationListItem } from './notifications.types';
import type { AuthTokenPayload } from '../auth/auth.service';

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  handleConnection(client: Socket) {
    const payload = this.authenticate(client);
    if (!payload) {
      client.disconnect(true);
      return;
    }

    const userId = payload.userId ?? payload.sub;
    if (!userId) {
      client.disconnect(true);
      return;
    }

    void client.join(this.getRoom(userId));
    client.emit('notifications:connected', { userId });
    this.logger.debug(`Socket connected for user ${userId}`);
  }

  handleDisconnect(client: Socket) {
    const payload = this.authenticate(client);
    const userId = payload?.userId ?? payload?.sub ?? null;
    if (userId) {
      this.logger.debug(`Socket disconnected for user ${userId}`);
    }
  }

  emitNotification(userId: number, notification: NotificationListItem) {
    this.server
      ?.to(this.getRoom(userId))
      .emit('notification:new', notification);
  }

  emitUnreadCount(userId: number, unreadCount: number) {
    this.server
      ?.to(this.getRoom(userId))
      .emit('notification:unread-count', { count: unreadCount });
  }

  emitBulkRefresh(userId: number) {
    this.server?.to(this.getRoom(userId)).emit('notification:refresh');
  }

  private authenticate(client: Socket): AuthTokenPayload | null {
    const cookieHeader = client.handshake.headers.cookie;
    if (typeof cookieHeader !== 'string' || cookieHeader.trim().length === 0) {
      return null;
    }

    const cookies = this.parseCookieHeader(cookieHeader);
    const accessToken = cookies.enterprise_access_token;
    if (!accessToken) {
      return null;
    }

    const secret = this.configService.get<string>('JWT_ACCESS_SECRET');
    const issuer = this.configService.get<string>('JWT_ISSUER');
    const audience = this.configService.get<string>('JWT_AUDIENCE');
    if (!secret || !issuer || !audience) {
      return null;
    }

    try {
      const payload = this.jwtService.verify<AuthTokenPayload>(accessToken, {
        secret,
        issuer,
        audience,
        algorithms: ['HS256'],
      });
      if (!payload || payload.tokenType !== 'access') {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  private parseCookieHeader(header: string): Record<string, string> {
    const result: Record<string, string> = {};
    header.split(';').forEach((part) => {
      const [rawName, ...rawValueParts] = part.trim().split('=');
      if (!rawName) {
        return;
      }
      const value = rawValueParts.join('=');
      if (!value) {
        return;
      }
      result[rawName] = decodeURIComponent(value);
    });
    return result;
  }

  private getRoom(userId: number): string {
    return `user:${userId}`;
  }
}
