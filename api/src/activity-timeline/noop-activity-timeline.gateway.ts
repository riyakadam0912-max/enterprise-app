export class NoOpActivityTimelineGateway {
  isEnabled(): boolean {
    return false;
  }

  handleConnection(): void {}

  handleDisconnect(): void {}

  emitTimelineCreated(_payload: {
    module: string;
    entityType: string;
    entityId: number;
    timelineId: number;
    performedBy?: number | null;
  }): void {}

  emitUserRefresh(_userId: number): void {}

  emitEntityRefresh(_entityType: string, _entityId: number): void {}
}
