import { PartialType } from '@nestjs/mapped-types';
import { CreateMarketingPostDto } from './create-marketing-post.dto';

export class UpdateMarketingPostDto extends PartialType(
  CreateMarketingPostDto,
) {}
