import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private isSchemaDriftError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError
      && (error.code === 'P2021' || error.code === 'P2022')
    );
  }

  async create(dto: CreateNotificationDto) {
    return this.prisma.notification.create({ data: dto });
  }

  async findAll(userId: number) {
    try {
      return await this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      if (this.isSchemaDriftError(error)) {
        return [];
      }
      throw error;
    }
  }

  async markRead(id: number) {
    return this.prisma.notification.update({ where: { id }, data: { isRead: true } });
  }

  async markAllRead(userId: number) {
    try {
      return await this.prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
    } catch (error) {
      if (this.isSchemaDriftError(error)) {
        return { count: 0 };
      }
      throw error;
    }
  }

  async getUnreadCount(userId: number) {
    try {
      const count = await this.prisma.notification.count({ where: { userId, isRead: false } });
      return { count };
    } catch (error) {
      if (this.isSchemaDriftError(error)) {
        return { count: 0 };
      }
      throw error;
    }
  }
}
