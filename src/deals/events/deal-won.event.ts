export class DealWonEvent {
  constructor(
    public readonly dealId: number,
    public readonly triggeredByUserId?: number,
  ) {}
}
