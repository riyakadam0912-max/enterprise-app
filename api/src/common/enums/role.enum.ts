import { Role as PrismaRole } from '@prisma/client';

// Re-export Prisma's Role enum to ensure type compatibility
export const Role = PrismaRole;
export type Role = PrismaRole;
