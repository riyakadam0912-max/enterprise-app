import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { OrganizationScopeService } from '../organizations/organization-scope.service';

@Module({
  providers: [PrismaService, OrganizationScopeService],
  exports: [PrismaService, OrganizationScopeService],
})
export class PrismaModule {}
