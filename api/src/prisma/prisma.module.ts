import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { OrganizationScopeService } from '../organizations/organization-scope.service';

@Module({
  imports: [ConfigModule],
  providers: [PrismaService, OrganizationScopeService],
  exports: [PrismaService, OrganizationScopeService],
})
export class PrismaModule {}
