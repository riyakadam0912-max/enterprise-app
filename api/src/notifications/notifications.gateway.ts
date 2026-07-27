import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { NotificationListItem } from './notifications.types';

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

  handleConnection(client: Socket) {
    const userId = this.resolveUserId(client);
    if (userId) {
      void client.join(this.getRoom(userId));
      client.emit('notifications:connected', { userId });
      this.logger.debug(`Socket connected for user ${userId}`);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = this.resolveUserId(client);
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

  private resolveUserId(client: Socket): number | null {
    const authUserId = Number(
      client.handshake.auth?.userId ?? client.handshake.query?.userId ?? 0,
    );
    if (Number.isInteger(authUserId) && authUserId > 0) {
      return authUserId;
    }

    const headerUserId = Number(client.handshake.headers['x-user-id'] ?? 0);
    if (Number.isInteger(headerUserId) && headerUserId > 0) {
      return headerUserId;
    }

    return null;
  }

  private getRoom(userId: number): string {
    return `user:${userId}`;
  }
}
