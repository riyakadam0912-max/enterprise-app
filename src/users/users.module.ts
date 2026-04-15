import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaModule } from '../prisma/prisma.module'; // 👈 IMPORT THIS

@Module({
  imports: [PrismaModule], // 👈 ADD THIS
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}