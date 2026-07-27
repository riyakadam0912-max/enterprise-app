import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [AuthModule, UsersModule, RbacModule],
  exports: [AuthModule, UsersModule, RbacModule],
})
export class IdentityModule {}
