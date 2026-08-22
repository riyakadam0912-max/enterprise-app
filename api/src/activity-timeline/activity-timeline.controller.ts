import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ActivityTimelineService } from './activity-timeline.service';
import { QueryActivityTimelineDto } from './dto/query-activity-timeline.dto';
import { CreateActivityTimelineCommentDto } from './dto/create-activity-timeline-comment.dto';
import { CreateActivityTimelineMentionDto } from './dto/create-activity-timeline-mention.dto';
import type { AuthenticatedRequest } from '../common/types/request';

@UseGuards(JwtAuthGuard)
@ApiTags('System - Activity Timeline')
@ApiBearerAuth()
@Controller('timeline')
export class ActivityTimelineController {
  constructor(private readonly timelineService: ActivityTimelineService) {}

  @ApiOperation({ summary: 'GET entity timeline' })
  @Get('entity/:entityType/:entityId')
  getEntityTimeline(
    @Param('entityType') entityType: string,
    @Param('entityId', ParseIntPipe) entityId: number,
    @Query() query: QueryActivityTimelineDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.timelineService.getEntityTimeline(
      entityType,
      entityId,
      query,
      req.user,
    );
  }

  @ApiOperation({ summary: 'GET global timeline' })
  @Get()
  getTimeline(
    @Query() query: QueryActivityTimelineDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.timelineService.getTimeline(query, req.user);
  }

  @ApiOperation({ summary: 'GET user activity' })
  @Get('user/:userId')
  getUserActivity(
    @Param('userId', ParseIntPipe) userId: number,
    @Query() query: QueryActivityTimelineDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.timelineService.getUserActivity(userId, query, req.user);
  }

  @ApiOperation({ summary: 'GET module activity' })
  @Get('module/:module')
  getModuleActivity(
    @Param('module') module: string,
    @Query() query: QueryActivityTimelineDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.timelineService.getModuleActivity(module, query, req.user);
  }

  @ApiOperation({ summary: 'POST comment' })
  @ApiBody({ type: CreateActivityTimelineCommentDto })
  @Post('comment')
  addComment(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateActivityTimelineCommentDto,
  ) {
    return this.timelineService.addComment(
      {
        timelineId: dto.timelineId,
        parentCommentId: dto.parentCommentId,
        userId: dto.userId ?? req.user.userId,
        userRole: dto.userRole ?? req.user.role,
        comment: dto.comment,
        mentions: dto.mentions,
        isInternal: dto.isInternal,
      },
      req.user,
    );
  }

  @ApiOperation({ summary: 'POST mention' })
  @ApiBody({ type: CreateActivityTimelineMentionDto })
  @Post('mention')
  createMention(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateActivityTimelineMentionDto,
  ) {
    return this.timelineService.createEvent(
      {
        module: dto.module,
        entityType: dto.entityType,
        entityId: dto.entityId,
        eventType: 'MENTIONED',
        action: 'MENTIONED',
        title: dto.title,
        description: dto.message,
        performedBy: dto.actorUserId ?? req.user.userId,
        status: 'INFO',
        priority: 'MEDIUM',
        metadata: { recipientIds: dto.recipientIds ?? [] },
      },
      req.user,
    );
  }

  @ApiOperation({ summary: 'DELETE timeline event' })
  @Delete(':id')
  deleteTimelineEvent(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.timelineService.deleteTimelineEvent(id, req.user);
  }

  @ApiOperation({
    summary:
      'GET live delta-sync — polling fallback for disabled WebSocket realtime',
  })
  @ApiResponse({ status: 200, description: 'Delta sync result since cursor.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @Get('live')
  getTimelineSince(
    @Query('since') sinceISO: string,
    @Query() query: QueryActivityTimelineDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const cursor =
      typeof sinceISO === 'string' && sinceISO.trim().length > 0
        ? sinceISO
        : new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const parsedUserId =
      typeof query.userId === 'string' && query.userId.trim().length > 0
        ? Number(query.userId)
        : null;
    type TimelineSinceQuery = {
      page?: number;
      limit?: number;
      search?: string;
      module?: string;
      eventType?: string;
      dateFrom?: string;
      dateTo?: string;
      entityType?: string;
      entityId?: number;
      userId?: number;
      moduleName?: string;
    };
    const serviceQuery: TimelineSinceQuery = {
      page: query.page,
      limit: query.limit,
      search: query.search,
      module: query.module,
      eventType: query.eventType,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    };
    if (parsedUserId !== null && Number.isFinite(parsedUserId)) {
      serviceQuery.userId = parsedUserId;
    }
    return this.timelineService.getTimelineSince(cursor, serviceQuery, req.user);
  }
}
