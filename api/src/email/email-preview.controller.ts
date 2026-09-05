import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { EMAIL_TEMPLATE_REQUIREMENTS } from './email.constants';
import { renderEmailTemplate, validateTemplateContext } from './email.utils';

interface EmailPreviewRequest {
  template: string;
  context?: Record<string, unknown>;
}

@Controller('email')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class EmailPreviewController {
  @Get('templates')
  listTemplates() {
    return Object.entries(EMAIL_TEMPLATE_REQUIREMENTS).map(
      ([name, requiredFields]) => ({ name, requiredFields }),
    );
  }

  @Post('preview')
  preview(@Body() body: EmailPreviewRequest) {
    const template = body.template?.trim();
    const context = body.context ?? {};

    if (
      !template ||
      !Object.prototype.hasOwnProperty.call(
        EMAIL_TEMPLATE_REQUIREMENTS,
        template,
      )
    ) {
      throw new BadRequestException('Unknown email template.');
    }

    if (typeof context !== 'object' || Array.isArray(context)) {
      throw new BadRequestException(
        'Email template context must be an object.',
      );
    }

    const missing = validateTemplateContext(template, context);
    if (missing.length > 0) {
      throw new BadRequestException(
        `Template ${template} is missing required values: ${missing.join(', ')}`,
      );
    }

    const rendered = renderEmailTemplate(template, context);
    return {
      template,
      ...rendered,
    };
  }
}
