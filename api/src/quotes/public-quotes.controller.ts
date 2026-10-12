import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { QuoteDecisionDto } from './dto/quote-decision.dto';
import { PublicQuotesService } from './public-quotes.service';

@Controller('public/quotes')
@ApiTags('Public Quotes')
export class PublicQuotesController {
  constructor(private readonly publicQuotesService: PublicQuotesService) {}

  @Get(':token')
  @ApiOperation({ summary: 'View a quote through a secure public link' })
  findOne(@Param('token') token: string) {
    return this.publicQuotesService.findOne(token);
  }

  @Post(':token/accept')
  decideAccept(@Param('token') token: string, @Body() dto: QuoteDecisionDto) {
    return this.publicQuotesService.decide(token, 'ACCEPTED', dto.comment);
  }

  @Post(':token/reject')
  decideReject(@Param('token') token: string, @Body() dto: QuoteDecisionDto) {
    return this.publicQuotesService.decide(token, 'REJECTED', dto.comment);
  }
}
