import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { NotificationListItem } from './notifications.types';
import type { AuthTokenPayload } from '../auth/auth.service';
import { websocketCors } from './websocket-cors';

@WebSocketGateway({
  namespace: '/notifications',
  cors: websocketCors,
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private readonly enabled: boolean;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.enabled =
      this.configService.get<boolean>('WEBSOCKET_ENABLED') ?? false;
    if (!this.enabled) {
      this.logger.warn(
        '[NotificationsGateway] WebSocket realtime disabled (WEBSOCKET_ENABLED=false). ' +
          'In-app notifications still persist to Postgres and frontend will poll /notifications/live. ' +
          'To enable realtime on a persistent host, set WEBSOCKET_ENABLED=true and configure REDIS_ENABLED=true.',
      );
    }
  }

  isEnabled(): boolean {
    return this.enabled && Boolean(this.server);
  }

  afterInit() {
    if (!this.enabled) {
      this.logger.log(
        '[NotificationsGateway] WebSocket realtime disabled; skipping gateway engine setup.',
      );
      return;
    }
    if (!this.server?.engine?.opts) {
      this.logger.warn(
        'Notification WebSocket server is unavailable; skipping Socket.IO CORS setup.',
      );
      return;
    }

    const nodeEnv = (
      this.configService.get<string>('NODE_ENV') || 'development'
    ).toLowerCase();
    const isProduction = nodeEnv === 'production';

    const primaryFrontendUrl =
      this.configService.get<string>('FRONTEND_URL') ??
      this.configService.get<string>('FRONTEND_ORIGIN');
    const configuredOrigins = (
      this.configService.get<string>('FRONTEND_URLS') ??
      this.configService.get<string>('FRONTEND_ORIGINS') ??
      ''
    )
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
    const allowedOrigins = new Set(
      [primaryFrontendUrl, ...configuredOrigins].filter(
        (origin): origin is string => Boolean(origin),
      ),
    );

    this.server.engine.opts.cors = {
      ...(this.server.engine.opts.cors ?? {}),
      origin: (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void,
      ) => {
        if (!origin) {
          callback(null, true);
          return;
        }
        if (allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }
        if (
          !isProduction &&
          (origin === 'http://localhost:3001' ||
            /^http:\/\/127\.0\.0\.1:3001$/.test(origin) ||
            /^http:\/\/192\.168\.\d+\.\d+:3001$/.test(origin))
        ) {
          callback(null, true);
          return;
        }
        this.logger.warn(
          `[NotificationsGateway] CORS blocked for WebSocket origin: ${origin}`,
        );
        callback(new Error(`CORS blocked for origin: ${origin}`), false);
      },
      credentials: true,
    };
  }

  handleConnection(client: Socket) {
    if (!this.enabled) {
      this.logger.debug(
        '[NotificationsGateway] Rejecting connection; WebSocket realtime disabled.',
      );
      client.disconnect(true);
      return;
    }
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
    if (!this.isEnabled()) {
      this.logger.debug(
        `[NotificationsGateway] emitNotification skipped (disabled); notification persisted to DB for userId=${userId}.`,
      );
      return;
    }
    this.server
      ?.to(this.getRoom(userId))
      .emit('notification:new', notification);
  }

  emitUnreadCount(userId: number, unreadCount: number) {
    if (!this.isEnabled()) return;
    this.server
      ?.to(this.getRoom(userId))
      .emit('notification:unread-count', { count: unreadCount });
  }

  emitBulkRefresh(userId: number) {
    if (!this.isEnabled()) return;
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
