import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { DealWonActionService } from './services/deal-won-action.service';
import { DealStatusUpdatedEvent } from './events/deal-status-updated.event';

type DealWonJobData = {
  dealId: number;
  previousStage: string;
  newStage: string;
  triggeredByUserId?: number;
};

@Processor('deal-queue')
export class DealProcessor extends WorkerHost {
  private readonly logger = new Logger(DealProcessor.name);

  constructor(private readonly dealWonActionService: DealWonActionService) {
    super();
  }

  async process(job: Job<DealWonJobData>): Promise<unknown> {
    if (job.name !== 'deal-won') {
      return { skipped: true, reason: `Unsupported job ${job.name}` };
    }

    this.logger.log(`Processing deal job for deal #${job.data.dealId}`);
    return this.dealWonActionService.handleDealStatusUpdate(
      new DealStatusUpdatedEvent(
        job.data.dealId,
        job.data.previousStage,
        job.data.newStage,
        job.data.triggeredByUserId,
      ),
    );
  }
}