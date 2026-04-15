import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { softDeleteMiddleware } from '../../prisma/middleware/softDelete';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor(private readonly configService: ConfigService) {
    super({
      datasources: {
        db: {
          url: configService.get<string>('DATABASE_URL'),
        },
      },
    });

    this.$use(softDeleteMiddleware());
  }

  async onModuleInit() {
    await this.$connect();
  }

  async softDeleteById(model: string, id: number) {
    return (this as any)[model].update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restoreById(model: string, id: number) {
    return (this as any)[model].update({
      where: { id },
      data: { deletedAt: null },
    });
  }
}