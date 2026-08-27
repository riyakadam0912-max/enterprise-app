import type { NotificationListItem } from './notifications.types';

export class NoOpNotificationsGateway {
  isEnabled(): boolean {
    return false;
  }

  afterInit(): void {}

  handleConnection(): void {}

  handleDisconnect(): void {}

  emitNotification(
    _userId: number,
    _notification: NotificationListItem,
  ): void {}

  emitUnreadCount(_userId: number, _unreadCount: number): void {}

  emitBulkRefresh(_userId: number): void {}
}
