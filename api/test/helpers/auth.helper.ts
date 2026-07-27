import { INestApplication } from '@nestjs/common';
import request, { Response } from 'supertest';
import { App } from 'supertest/types';
import { UserFactory } from '../fixtures/user.factory';
import { OrganizationFactory } from '../fixtures/organization.factory';
import { Role } from '@prisma/client';
import { DatabaseHelper } from './database.helper';

type TestApp = INestApplication<App>;

type AuthResult = {
  user: Awaited<ReturnType<typeof UserFactory.create>>;
  organization: Awaited<ReturnType<typeof OrganizationFactory.findOrCreate>>;
  organizationId: number;
  accessToken: string | undefined;
  refreshToken: string | undefined;
  authHeaders: Record<string, string>;
};

type LoginResult = {
  accessToken: string | undefined;
  refreshToken: string | undefined;
  authHeaders: Record<string, string>;
};

// Helper function to extract a cookie value from set-cookie headers
function extractCookieValue(
  setCookieHeaders: string[],
  cookieName: string,
): string | undefined {
  for (const header of setCookieHeaders) {
    const cookiePart = header.split(';')[0];
    const [name, value] = cookiePart.split('=');
    if (name === cookieName) {
      return value;
    }
  }
  return undefined;
}

export class AuthHelper {
  static async createTestUserAndLogin(
    app: TestApp,
    organizationId?: number,
  ): Promise<AuthResult> {
    const prisma = DatabaseHelper.getPrismaClient();
    const organization = await OrganizationFactory.findOrCreate(organizationId);
    const orgId = organization.id;

    // Create test user
    const user = await UserFactory.create({
      organizationId: orgId,
      email: `test-${Date.now()}@example.com`,
      password: 'password123',
    });

    const role = await prisma.appRole.upsert({
      where: { name: Role.ADMIN },
      update: {},
      create: {
        name: Role.ADMIN,
        description: 'Administrator with broad access',
      },
    });

    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: role.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        roleId: role.id,
      },
    });

    // Login to get access token
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: user.email,
        password: 'password123',
      });

    // Extract tokens from cookies since they are set in cookies instead of response body
    const setCookie = loginResponse.headers['set-cookie'];
    const cookies = Array.isArray(setCookie)
      ? setCookie
      : setCookie
        ? [setCookie]
        : [];
    const accessToken = extractCookieValue(cookies, 'enterprise_access_token');
    const refreshToken = extractCookieValue(
      cookies,
      'enterprise_refresh_token',
    );

    return {
      user,
      organization,
      organizationId: orgId,
      accessToken,
      refreshToken,
      authHeaders: {
        Authorization: `Bearer ${accessToken}`,
      },
    };
  }

  static async login(
    app: TestApp,
    email: string,
    password: string,
  ): Promise<LoginResult> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password });

    const setCookie = response.headers['set-cookie'];
    const cookies = Array.isArray(setCookie)
      ? setCookie
      : setCookie
        ? [setCookie]
        : [];
    const accessToken = extractCookieValue(cookies, 'enterprise_access_token');
    const refreshToken = extractCookieValue(
      cookies,
      'enterprise_refresh_token',
    );

    return {
      accessToken,
      refreshToken,
      authHeaders: {
        Authorization: `Bearer ${accessToken}`,
      },
    };
  }

  static async createSuperAdminWithOrganizationAndLogin(
    app: TestApp,
  ): Promise<AuthResult> {
    const prisma = DatabaseHelper.getPrismaClient();
    const organization = await OrganizationFactory.findOrCreate();
    const orgId = organization.id;

    const user = await UserFactory.create({
      organizationId: null,
      email: `superadmin-${Date.now()}@example.com`,
      password: 'password123',
      role: Role.SUPER_ADMIN,
    });

    const role = await prisma.appRole.upsert({
      where: { name: Role.SUPER_ADMIN },
      update: {},
      create: {
        name: Role.SUPER_ADMIN,
        description: 'Platform super administrator',
      },
    });

    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: role.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        roleId: role.id,
      },
    });

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: user.email,
        password: 'password123',
      });

    const setCookie = loginResponse.headers['set-cookie'];
    const cookies = Array.isArray(setCookie)
      ? setCookie
      : setCookie
        ? [setCookie]
        : [];
    const accessToken = extractCookieValue(cookies, 'enterprise_access_token');
    const refreshToken = extractCookieValue(
      cookies,
      'enterprise_refresh_token',
    );

    return {
      user,
      organization,
      organizationId: orgId,
      accessToken,
      refreshToken,
      authHeaders: {
        Authorization: `Bearer ${accessToken}`,
      },
    };
  }
}
