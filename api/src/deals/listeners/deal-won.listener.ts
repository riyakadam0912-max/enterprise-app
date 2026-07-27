import { Injectable, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DealStatusUpdatedEvent } from '../events/deal-status-updated.event';
import { DealWonActionService } from '../services/deal-won-action.service';

@Injectable()
export class DealWonListener {
  constructor(
    @Optional() @InjectQueue('deal-queue') private readonly dealQueue?: Queue,
    private readonly dealWonActionService?: DealWonActionService,
  ) {}

  @OnEvent('deal.status_updated')
  async handleDealStatusUpdate(event: DealStatusUpdatedEvent) {
    if (event.newStage !== 'WON') {
      return { skipped: true };
    }

    if (!this.dealQueue || !this.dealWonActionService) {
      return this.dealWonActionService?.handleDealStatusUpdate(event);
    }

    try {
      return await this.dealQueue.add(
        'deal-won',
        {
          dealId: event.dealId,
          previousStage: event.previousStage,
          newStage: event.newStage,
          triggeredByUserId: event.triggeredByUserId,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
    } catch {
      return this.dealWonActionService.handleDealStatusUpdate(event);
    }
  }
}
