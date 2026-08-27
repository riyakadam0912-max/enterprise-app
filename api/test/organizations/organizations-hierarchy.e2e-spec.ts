import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppHelper } from '../helpers/app.helper';
import { AuthHelper } from '../helpers/auth.helper';
import { OrganizationFactory } from '../fixtures/organization.factory';

/**
 * E2E tests: Organisation hierarchy scoping and SA org-switching.
 *
 * Covers:
 *  1. SA with no X-Organization-Id gets a flat global list.
 *  2. SA switches to Org A (X-Organization-Id = A.id) → list returns only A's children.
 *  3. SA switches to Org B (X-Organization-Id = B.id) → list returns only B's children.
 *  4. SA can fetch details of any org by ID (/organizations/:id).
 *  5. Org B's children do NOT appear when scoped to Org A.
 *  6. Non-SA admin sees only children of their own org.
 */
describe('Organisation hierarchy & SA org-switching (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;

  beforeAll(async () => {
    AppHelper.beforeAll();
    app = await AppHelper.createTestingApp();
    server = app.getHttpServer();
  });

  beforeEach(async () => {
    await AppHelper.beforeEach();
  });

  afterAll(async () => {
    await AppHelper.afterAll(app);
  });

  // ── SA global list ─────────────────────────────────────────────────────

  it('SA without X-Organization-Id sees the global org list (no hierarchy scoping)', async () => {
    const { accessToken } =
      await AuthHelper.createSuperAdminWithOrganizationAndLogin(app);

    const orgA = await OrganizationFactory.create({
      name: `Parent A ${Date.now()}`,
      slug: `parent-a-${Date.now()}`,
    });
    const orgB = await OrganizationFactory.create({
      name: `Parent B ${Date.now()}`,
      slug: `parent-b-${Date.now()}`,
    });

    const listResp = await request(server)
      .get('/api/v1/organizations')
      .set('Authorization', `Bearer ${accessToken}`);
    // No X-Organization-Id → global list
    expect(listResp.status).toBe(200);
    expect(Array.isArray(listResp.body)).toBe(true);

    const ids = (listResp.body as Array<{ id: number }>).map((o) => o.id);
    expect(ids).toEqual(expect.arrayContaining([orgA.id, orgB.id]));
  });

  // ── SA switches between two parent orgs ───────────────────────────────

  it("SA switching org context sees only that org's children, never sibling orgs", async () => {
    const { accessToken } =
      await AuthHelper.createSuperAdminWithOrganizationAndLogin(app);

    // Create two independent parent organisations
    const parentA = await OrganizationFactory.create({
      name: `Corp A ${Date.now()}`,
      slug: `corp-a-${Date.now()}`,
    });
    const parentB = await OrganizationFactory.create({
      name: `Corp B ${Date.now()}`,
      slug: `corp-b-${Date.now()}`,
    });

    // Create one child under each parent
    const childOfA = await OrganizationFactory.create({
      name: `Child of A ${Date.now()}`,
      slug: `child-a-${Date.now()}`,
      parentId: parentA.id,
    });
    const childOfB = await OrganizationFactory.create({
      name: `Child of B ${Date.now()}`,
      slug: `child-b-${Date.now()}`,
      parentId: parentB.id,
    });

    // --- Scoped to Parent A ---
    const listUnderA = await request(server)
      .get('/api/v1/organizations')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Organization-Id', String(parentA.id));
    expect(listUnderA.status).toBe(200);
    const idsUnderA = (listUnderA.body as Array<{ id: number }>).map(
      (o) => o.id,
    );
    expect(idsUnderA).toContain(childOfA.id);
    expect(idsUnderA).not.toContain(childOfB.id);
    expect(idsUnderA).not.toContain(parentB.id);

    // --- Switch: scoped to Parent B ---
    const listUnderB = await request(server)
      .get('/api/v1/organizations')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Organization-Id', String(parentB.id));
    expect(listUnderB.status).toBe(200);
    const idsUnderB = (listUnderB.body as Array<{ id: number }>).map(
      (o) => o.id,
    );
    expect(idsUnderB).toContain(childOfB.id);
    expect(idsUnderB).not.toContain(childOfA.id);
    expect(idsUnderB).not.toContain(parentA.id);
  });

  // ── SA fetches org details by ID ──────────────────────────────────────

  it('SA can fetch org details (name, logoUrl, slug) for any org by ID', async () => {
    const { accessToken } =
      await AuthHelper.createSuperAdminWithOrganizationAndLogin(app);

    const org = await OrganizationFactory.create({
      name: `Detail Org ${Date.now()}`,
      slug: `detail-org-${Date.now()}`,
    });

    const getResp = await request(server)
      .get(`/api/v1/organizations/${org.id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(getResp.status).toBe(200);
    expect(getResp.body?.success).toBe(true);
    expect(getResp.body?.data?.id).toBe(org.id);
    expect(getResp.body?.data?.name).toBe(org.name);
    expect(getResp.body?.data?.slug).toBe(org.slug);
    // logoUrl field must be present (null is fine if not set)
    expect('logoUrl' in getResp.body.data).toBe(true);
  });

  // ── Explicit ?parentId param ──────────────────────────────────────────

  it('SA can use ?parentId query param to scope children of any org without X-Organization-Id', async () => {
    const { accessToken } =
      await AuthHelper.createSuperAdminWithOrganizationAndLogin(app);

    const parent = await OrganizationFactory.create({
      name: `ParamParent ${Date.now()}`,
      slug: `param-parent-${Date.now()}`,
    });
    const child = await OrganizationFactory.create({
      name: `ParamChild ${Date.now()}`,
      slug: `param-child-${Date.now()}`,
      parentId: parent.id,
    });
    const unrelated = await OrganizationFactory.create({
      name: `Unrelated ${Date.now()}`,
      slug: `unrelated-${Date.now()}`,
    });

    const listResp = await request(server)
      .get(`/api/v1/organizations?parentId=${parent.id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(listResp.status).toBe(200);
    const ids = (listResp.body as Array<{ id: number }>).map((o) => o.id);
    expect(ids).toContain(child.id);
    expect(ids).not.toContain(unrelated.id);
    expect(ids).not.toContain(parent.id); // parent itself is not a child of itself
  });

  // ── Non-SA org admin isolation ────────────────────────────────────────

  it("non-SA org admin sees only their own org's direct children", async () => {
    const ownOrg = await OrganizationFactory.create({
      name: `Own Org ${Date.now()}`,
      slug: `own-org-${Date.now()}`,
    });
    const sibling = await OrganizationFactory.create({
      name: `Sibling Org ${Date.now()}`,
      slug: `sibling-org-${Date.now()}`,
    });

    const childOfOwn = await OrganizationFactory.create({
      name: `Child of Own ${Date.now()}`,
      slug: `child-of-own-${Date.now()}`,
      parentId: ownOrg.id,
    });
    const childOfSibling = await OrganizationFactory.create({
      name: `Child of Sibling ${Date.now()}`,
      slug: `child-of-sibling-${Date.now()}`,
      parentId: sibling.id,
    });

    const admin = await AuthHelper.createTestUserAndLogin(app, ownOrg.id);

    const listResp = await request(server)
      .get('/api/v1/organizations')
      .set(admin.authHeaders);
    expect(listResp.status).toBe(200);
    const ids = (listResp.body as Array<{ id: number }>).map((o) => o.id);

    // Must see own org's child
    expect(ids).toContain(childOfOwn.id);
    // Must NOT see sibling org or sibling's child
    expect(ids).not.toContain(sibling.id);
    expect(ids).not.toContain(childOfSibling.id);
    // Every returned org must be parented to ownOrg
    for (const org of listResp.body as Array<{ parentId: number | null }>) {
      expect(org.parentId).toBe(ownOrg.id);
    }
  });
});
