import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { Role } from '../common/enums/role.enum';
import { Permission } from '../common/enums/permissions.enum';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { MailService } from '../mail/mail.service';
import type ms from 'ms';

export type AuthTokenPayload = {
  sub: number;
  userId: number;
  email: string;
  name: string;
  role: Role;
  roles: string[];
  permissions: string[];
  employeeId: number | null;
  organizationId: number | null;
  organizationSlug?: string | null;
  isPlatformAdmin?: boolean;
  isSuperAdmin?: boolean;
  tokenType: 'access' | 'refresh';
  jti?: string;
};

type UserRoleRecord = {
  role: {
    name: string;
    rolePermissions: Array<{
      permission: {
        key: string;
      };
    }>;
  };
};

type UserWithRoles = {
  id: number;
  name: string;
  email: string;
  password: string;
  isActive: boolean;
  role: Role;
  employeeId: number | null;
  organizationId: number | null;
  refreshToken: string | null;
  userRoles: UserRoleRecord[];
};

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditLogsService: AuditLogsService,
    private readonly mailService: MailService,
  ) {}

  private async getOrCreateDefaultOrganization() {
    let org = await this.prisma.organization.findFirst({
      where: { code: 'DEFAULT' },
    });
    if (!org) {
      org = await this.prisma.organization.create({
        data: {
          name: 'Default Organization',
          code: 'DEFAULT',
          slug: 'default',
          status: 'ACTIVE',
        },
      });
    }
    return org;
  }

  async register(
    name: string,
    email: string,
    password: string,
    role: Role = Role.EMPLOYEE,
    employeeId?: number,
  ) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already in use');

    if (employeeId) {
      const employee = await this.prisma.employee.findUnique({
        where: { id: employeeId },
      });
      if (!employee) {
        throw new NotFoundException('Employee not found');
      }
    }

    const defaultOrg = await this.getOrCreateDefaultOrganization();
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        employeeId,
        organizationId: defaultOrg.id,
      },
    });

    return { message: 'User registered successfully', userId: user.id };
  }

  async bootstrapAdmin() {
    const adminExists = await this.prisma.user.findFirst({
      where: {
        OR: [{ role: Role.ADMIN }, { email: 'admin@erp.local' }],
      },
    });
    if (adminExists) {
      throw new ConflictException('Admin already exists');
    }

    const defaultOrg = await this.getOrCreateDefaultOrganization();
    const rawPassword = this.getBootstrapPassword(
      'BOOTSTRAP_ADMIN_PASSWORD',
      'Admin',
    );
    const hashedPassword = await bcrypt.hash(rawPassword, 10);
    const admin = await this.prisma.user.create({
      data: {
        name: 'Admin User',
        email: 'admin@erp.local',
        password: hashedPassword,
        role: Role.ADMIN,
        isActive: true,
        organizationId: defaultOrg.id,
      },
    });

    // Make sure roles/permissions are set up
    await this.seedPermissionsAndRolesIfNeeded();

    // Assign the ADMIN role
    const appRole = await this.prisma.appRole.upsert({
      where: { name: Role.ADMIN },
      update: {},
      create: {
        name: Role.ADMIN,
        description: 'Administrator with broad access',
      },
    });
    await this.prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: admin.id,
          roleId: appRole.id,
        },
      },
      update: {},
      create: {
        userId: admin.id,
        roleId: appRole.id,
      },
    });

    return { message: 'Admin created successfully', userId: admin.id };
  }

  private async seedPermissionsAndRolesIfNeeded() {
    // Check if permissions already exist
    const existingPermissions = await this.prisma.permission.count();
    if (existingPermissions > 0) {
      return;
    }

    const permissionsToCreate = Object.values(Permission).map((key) => ({
      key: key as string,
      description: `Permission for ${key}`,
    }));

    for (const permission of permissionsToCreate) {
      await this.prisma.permission.upsert({
        where: { key: permission.key },
        update: {},
        create: permission,
      });
    }

    // Create ADMIN role with all permissions
    const adminRole = await this.prisma.appRole.upsert({
      where: { name: Role.ADMIN },
      update: {},
      create: {
        name: Role.ADMIN,
        description: 'Administrator with broad access',
      },
    });

    const allPermissions = await this.prisma.permission.findMany();
    for (const permission of allPermissions) {
      await this.prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: adminRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: { roleId: adminRole.id, permissionId: permission.id },
      });
    }
  }

  async getProfile(userId: number) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    return user;
  }

  async updateProfile(
    userId: number,
    data: { name?: string; phone?: string; address?: string },
  ) {
    const updateData: Record<string, string> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.address !== undefined) updateData.address = data.address;

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
    return user;
  }

  private async resolveOrganizationSlug(organizationId: number | null) {
    if (!organizationId) {
      return null;
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { slug: true },
    });

    return organization?.slug ?? null;
  }

  async login(email: string, password: string) {
    const user = (await this.prisma.user.findUnique({
      where: { email },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    })) as UserWithRoles | null;

    if (!user) {
      await this.auditLogsService.logLogin({
        userName: email,
        module: 'Auth',
        entityType: 'User',
        action: 'LOGIN_FAILURE',
        success: false,
        reason: 'Invalid email or password',
        description: `Failed login attempt for ${email}`,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      await this.auditLogsService.logLogin({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        module: 'Auth',
        entityType: 'User',
        entityId: user.id,
        action: 'LOGIN_FAILURE',
        success: false,
        reason: 'User account is inactive',
        description: `Inactive account login attempt for ${user.email}`,
      });
      throw new UnauthorizedException('User account is inactive');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      await this.auditLogsService.logLogin({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        module: 'Auth',
        entityType: 'User',
        entityId: user.id,
        action: 'LOGIN_FAILURE',
        success: false,
        reason: 'Invalid email or password',
        description: `Invalid password for ${user.email}`,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    // Backward compatibility: if no userRoles, create one based on user.role
    let processedUserRoles = user.userRoles || [];
    if (processedUserRoles.length === 0 && user.role) {
      try {
        // Find or create the AppRole with name matching user.role
        const appRole = await this.prisma.appRole.upsert({
          where: { name: user.role },
          update: {},
          create: {
            name: user.role,
            description: `Auto-created role for ${user.role}`,
          },
        });

        // Assign the role to the user
        const assignedRole = await this.prisma.userRole.create({
          data: { userId: user.id, roleId: appRole.id },
          include: {
            role: {
              include: { rolePermissions: { include: { permission: true } } },
            },
          },
        });

        processedUserRoles = [assignedRole];
      } catch (e) {
        // If anything fails, just use empty array
        console.warn('Failed to auto-assign role to user:', e);
      }
    }

    const userRoles: string[] = processedUserRoles.map((ur) => ur.role.name);
    const userPermissions: string[] = [
      ...new Set(
        processedUserRoles.flatMap((ur) =>
          ur.role.rolePermissions.map((rp) => rp.permission.key),
        ),
      ),
    ];

    const organizationSlug = await this.resolveOrganizationSlug(
      user.organizationId ?? null,
    );
    const isSuperAdmin = user.role === Role.SUPER_ADMIN;

    const tokens = await this.issueTokenPair(
      {
        sub: user.id,
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        roles: userRoles,
        permissions: userPermissions,
        employeeId: user.employeeId ?? null,
        organizationId: user.organizationId ?? null,
        organizationSlug,
        isPlatformAdmin: isSuperAdmin,
        isSuperAdmin,
        tokenType: 'access',
      },
      user.id,
    );

    await this.auditLogsService.logLogin(
      {
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        module: 'Auth',
        entityType: 'User',
        entityId: user.id,
        action: 'LOGIN_SUCCESS',
        success: true,
        description: `User ${user.email} logged in successfully`,
      },
      {
        id: user.id,
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        roles: processedUserRoles.map((ur) => ur.role.name),
        permissions: userPermissions,
        employeeId: user.employeeId,
        organizationId: user.organizationId,
        tokenType: 'access',
        jti: null,
      },
    );
    return {
      message: 'Login successful',
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      role: user.role,
      roles: userRoles,
      permissions: userPermissions,
      employeeId: user.employeeId ?? null,
      organizationId: user.organizationId ?? null,
      organizationSlug,
      isSuperAdmin,
      isPlatformAdmin: isSuperAdmin,
    };
  }

  async refreshTokens(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    let payload: AuthTokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<AuthTokenPayload>(
        refreshToken,
        {
          secret: this.refreshTokenSecret,
          issuer: this.jwtIssuer,
          audience: this.jwtAudience,
          algorithms: ['HS256'],
        },
      );
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.tokenType !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = (await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    })) as UserWithRoles | null;

    if (!user || !user.isActive || !user.refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenMatches = this.matchesRefreshToken(
      refreshToken,
      user.refreshToken,
    );
    if (!tokenMatches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Backward compatibility: if no userRoles, create one based on user.role
    let processedUserRoles = user.userRoles || [];
    if (processedUserRoles.length === 0 && user.role) {
      try {
        // Find or create the AppRole with name matching user.role
        const appRole = await this.prisma.appRole.upsert({
          where: { name: user.role },
          update: {},
          create: {
            name: user.role,
            description: `Auto-created role for ${user.role}`,
          },
        });

        // Assign the role to the user
        const assignedRole = (await this.prisma.userRole.create({
          data: { userId: user.id, roleId: appRole.id },
          include: {
            role: {
              include: { rolePermissions: { include: { permission: true } } },
            },
          },
        })) as UserRoleRecord;

        processedUserRoles = [assignedRole];
      } catch (e) {
        // If anything fails, just use empty array
        console.warn('Failed to auto-assign role to user:', e);
      }
    }

    const userRoles: string[] = processedUserRoles.map((ur) => ur.role.name);
    const userPermissions: string[] = [
      ...new Set(
        processedUserRoles.flatMap((ur) =>
          ur.role.rolePermissions.map((rp) => rp.permission.key),
        ),
      ),
    ];

    const organizationSlug = await this.resolveOrganizationSlug(
      user.organizationId ?? null,
    );
    const isSuperAdmin = user.role === Role.SUPER_ADMIN;

    const tokens = await this.issueTokenPair(
      {
        sub: user.id,
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        roles: userRoles,
        permissions: userPermissions,
        employeeId: user.employeeId ?? null,
        organizationId: user.organizationId ?? null,
        organizationSlug,
        isPlatformAdmin: isSuperAdmin,
        isSuperAdmin,
        tokenType: 'access',
      },
      user.id,
    );

    return {
      message: 'Token refreshed successfully',
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      role: user.role,
      roles: userRoles,
      permissions: userPermissions,
      employeeId: user.employeeId ?? null,
      organizationId: user.organizationId ?? null,
      organizationSlug,
      isSuperAdmin,
      isPlatformAdmin: isSuperAdmin,
    };
  }

  async logout(userId: number) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });

    await this.auditLogsService.logLogout(
      {
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        module: 'Auth',
        entityType: 'User',
        entityId: user.id,
        action: 'LOGOUT',
        description: `User ${user.email} logged out`,
      },
      {
        id: user.id,
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        roles: [],
        permissions: [],
        employeeId: user.employeeId,
        organizationId: user.organizationId,
        tokenType: 'access',
        jti: null,
      },
    );

    return { message: 'Logout successful' };
  }

  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return {
        message:
          'If that email exists, password reset instructions have been sent.',
      };
    }

    const resetToken = this.jwtService.sign(
      {
        sub: user.id,
        userId: user.id,
        email: user.email,
        role: user.role,
        employeeId: user.employeeId ?? null,
        tokenType: 'reset',
      },
      {
        secret: this.refreshTokenSecret,
        expiresIn: '1h',
        issuer: this.jwtIssuer,
        audience: this.jwtAudience,
        algorithm: 'HS256' as const,
      },
    );

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ??
      this.configService.get<string>('FRONTEND_ORIGIN') ??
      'http://localhost:3001';

    const resetUrl = `${frontendUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(resetToken)}`;

    await this.mailService.sendEmail({
      to: user.email,
      subject: 'Password reset request',
      html: `Please click <a href="${resetUrl}">here</a> to reset your password. This link expires in one hour.`,
      metadata: { userId: user.id, template: 'forgot-password' },
    });

    return {
      message:
        'If that email exists, password reset instructions have been sent.',
    };
  }

  private async issueTokenPair(payload: AuthTokenPayload, userId: number) {
    const signingPayload: any = { ...payload };

    const accessToken = this.jwtService.sign(signingPayload, {
      secret: this.accessTokenSecret,
      expiresIn: this.accessTokenExpiresIn,
      issuer: this.jwtIssuer,
      audience: this.jwtAudience,
      algorithm: 'HS256' as const,
    });

    const refreshTokenPayload: AuthTokenPayload = {
      ...payload,
      tokenType: 'refresh',
      jti: randomUUID(),
    };

    const refreshToken = this.jwtService.sign(refreshTokenPayload, {
      secret: this.refreshTokenSecret,
      expiresIn: this.refreshTokenExpiresIn,
      issuer: this.jwtIssuer,
      audience: this.jwtAudience,
      algorithm: 'HS256' as const,
    });
    const hashedRefreshToken = this.hashRefreshToken(refreshToken);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hashedRefreshToken },
    });

    return { accessToken, refreshToken };
  }

  private hashRefreshToken(refreshToken: string): string {
    return createHash('sha256').update(refreshToken).digest('hex');
  }

  private matchesRefreshToken(
    refreshToken: string,
    storedHash: string,
  ): boolean {
    const computedHash = Buffer.from(
      this.hashRefreshToken(refreshToken),
      'hex',
    );
    const storedHashBuffer = Buffer.from(storedHash, 'hex');

    if (computedHash.length !== storedHashBuffer.length) {
      return false;
    }

    return timingSafeEqual(computedHash, storedHashBuffer);
  }

  private get accessTokenSecret(): string {
    const secret = this.configService.get<string>('JWT_ACCESS_SECRET');
    if (!secret) {
      throw new Error('JWT_ACCESS_SECRET is required');
    }
    return secret;
  }

  private get refreshTokenSecret(): string {
    const secret = this.configService.get<string>('JWT_REFRESH_SECRET');
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET is required');
    }
    return secret;
  }

  private get jwtIssuer(): string {
    const issuer = this.configService.get<string>('JWT_ISSUER');
    if (!issuer) {
      throw new Error('JWT_ISSUER is required');
    }
    return issuer;
  }

  private get jwtAudience(): string {
    const audience = this.configService.get<string>('JWT_AUDIENCE');
    if (!audience) {
      throw new Error('JWT_AUDIENCE is required');
    }
    return audience;
  }

  private get accessTokenExpiresIn(): ms.StringValue {
    return (this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ??
      '1d') as ms.StringValue;
  }

  private get refreshTokenExpiresIn(): ms.StringValue {
    return (this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ??
      '7d') as ms.StringValue;
  }

  private getBootstrapPassword(envKey: string, label: string): string {
    const fromEnv = this.configService.get<string>(envKey);
    if (fromEnv && fromEnv.trim().length > 0) {
      return fromEnv.trim();
    }
    const generated = randomBytes(24).toString('base64url');
    console.warn(
      `[AUTH-BOOTSTRAP] ${envKey} not set. Generated random ${label} password: ${generated}`,
    );
    return generated;
  }

  async bootstrapSuperAdmin() {
    await this.seedPermissionsAndRolesIfNeeded();

    const existingSuperAdmin = await this.prisma.user.findFirst({
      where: {
        OR: [{ role: Role.SUPER_ADMIN }, { email: 'superadmin@erp.local' }],
      },
    });

    let superAdmin;
    if (existingSuperAdmin) {
      superAdmin = await this.prisma.user.update({
        where: { id: existingSuperAdmin.id },
        data: {
          name: 'Super Admin User',
          email: 'superadmin@erp.local',
          role: Role.SUPER_ADMIN,
          isActive: true,
          organizationId: null,
        },
      });
    } else {
      const rawPassword = this.getBootstrapPassword(
        'BOOTSTRAP_SUPER_ADMIN_PASSWORD',
        'Super Admin',
      );
      const hashedPassword = await bcrypt.hash(rawPassword, 10);
      superAdmin = await this.prisma.user.create({
        data: {
          name: 'Super Admin User',
          email: 'superadmin@erp.local',
          password: hashedPassword,
          role: Role.SUPER_ADMIN,
          isActive: true,
          organizationId: null,
        },
      });
    }

    const appRole = await this.prisma.appRole.upsert({
      where: { name: Role.SUPER_ADMIN },
      update: {},
      create: {
        name: Role.SUPER_ADMIN,
        description: 'Platform Super Admin with full access',
      },
    });

    await this.prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: superAdmin.id,
          roleId: appRole.id,
        },
      },
      update: {},
      create: {
        userId: superAdmin.id,
        roleId: appRole.id,
      },
    });

    return {
      message: existingSuperAdmin
        ? 'Super Admin updated successfully'
        : 'Super Admin created successfully',
      userId: superAdmin.id,
    };
  }

  async resetPassword(token: string, newPassword: string) {
    let payload: any;

    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.refreshTokenSecret,
        issuer: this.jwtIssuer,
        audience: this.jwtAudience,
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    if (payload.tokenType !== 'reset') {
      throw new UnauthorizedException('Invalid reset token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Hash password with bcrypt - exactly once
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    await this.auditLogsService.logLogin({
      userId: updatedUser.id,
      userName: updatedUser.name,
      userRole: updatedUser.role,
      module: 'Auth',
      entityType: 'User',
      entityId: updatedUser.id,
      action: 'PASSWORD_RESET',
      success: true,
      description: `User ${updatedUser.email} reset their password`,
    });

    return { message: 'Password reset successfully' };
  }
}
