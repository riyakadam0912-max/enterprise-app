import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import type { AuthenticatedRequest } from '../common/types/request';
import { CreateMarketingPostDto } from './dto/create-marketing-post.dto';
import { UpdateMarketingPostDto } from './dto/update-marketing-post.dto';
import { MarketingPostsService } from './marketing-posts.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiTags('CRM - Marketing Posts')
@ApiBearerAuth()
@Controller('marketing-posts')
export class MarketingPostsController {
  constructor(private readonly service: MarketingPostsService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.service.list(req.user);
  }

  @Post()
  create(
    @Body() dto: CreateMarketingPostDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.create(dto, req.user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMarketingPostDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.update(id, dto, req.user);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.remove(id, req.user);
  }
}
