import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { websocketCors } from '../notifications/websocket-cors';

@WebSocketGateway({
  namespace: '/timeline',
  cors: websocketCors,
})
export class ActivityTimelineGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ActivityTimelineGateway.name);
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    this.enabled =
      this.configService.get<boolean>('WEBSOCKET_ENABLED') ?? false;
    if (!this.enabled) {
      this.logger.warn(
        '[ActivityTimelineGateway] WebSocket realtime disabled (WEBSOCKET_ENABLED=false). ' +
          'Timeline writes still persist to Postgres; in-app activity pages must refresh or poll.',
      );
    }
  }

  isEnabled(): boolean {
    return this.enabled && Boolean(this.server);
  }

  handleConnection(client: Socket) {
    if (!this.enabled) {
      this.logger.debug(
        '[ActivityTimelineGateway] Rejecting connection; WebSocket realtime disabled.',
      );
      client.disconnect(true);
      return;
    }
    const userId = Number(
      client.handshake.auth?.userId ?? client.handshake.query?.userId ?? 0,
    );
    if (Number.isInteger(userId) && userId > 0) {
      void client.join(this.userRoom(userId));
      this.logger.debug(`Timeline socket connected for user ${userId}`);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = Number(
      client.handshake.auth?.userId ?? client.handshake.query?.userId ?? 0,
    );
    if (Number.isInteger(userId) && userId > 0) {
      this.logger.debug(`Timeline socket disconnected for user ${userId}`);
    }
  }

  emitTimelineCreated(payload: {
    module: string;
    entityType: string;
    entityId: number;
    timelineId: number;
    performedBy?: number | null;
  }) {
    if (!this.isEnabled()) return;
    this.server
      ?.to(this.entityRoom(payload.entityType, payload.entityId))
      .emit('timeline:new', payload);
    if (payload.performedBy) {
      this.server
        ?.to(this.userRoom(payload.performedBy))
        .emit('timeline:new', payload);
    }
  }

  emitUserRefresh(userId: number) {
    if (!this.isEnabled()) return;
    this.server?.to(this.userRoom(userId)).emit('timeline:refresh');
  }

  emitEntityRefresh(entityType: string, entityId: number) {
    if (!this.isEnabled()) return;
    this.server
      ?.to(this.entityRoom(entityType, entityId))
      .emit('timeline:refresh');
  }

  private userRoom(userId: number) {
    return `user:${userId}`;
  }

  private entityRoom(entityType: string, entityId: number) {
    return `entity:${entityType}:${entityId}`;
  }
}
