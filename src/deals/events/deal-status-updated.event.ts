/**
 * DealStatusUpdatedEvent
 * Emitted when a deal's status is updated to trigger downstream actions
 */
export class DealStatusUpdatedEvent {
  constructor(
    public readonly dealId: number,
    public readonly previousStage: string,
    public readonly newStage: string,
    public readonly triggeredByUserId?: number,
  ) {}
}
