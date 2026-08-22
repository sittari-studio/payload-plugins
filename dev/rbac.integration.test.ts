import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { permissionsMatrixFieldPath } from '@sittari/payload-rbac';
import { getPayload, type Payload, type SelectField } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Role } from './payload-types.js';
import { devAdminRoleName, devRbacRoles } from './rbac.js';
import { devUser } from './seed.js';

const databaseFile = join(tmpdir(), `sittari-dev-rbac-${randomUUID()}.sqlite`);
let payload: Payload;

beforeAll(async () => {
  process.env.DATABASE_URL = `file:${databaseFile}`;
  const { default: config } = await import('./payload.config.js');
  payload = await getPayload({
    config,
    disableOnInit: true,
    key: `dev-rbac-${databaseFile}`,
  });

  for (const role of [
    { name: devAdminRoleName, permissions: ['*'] },
    ...devRbacRoles,
  ]) {
    await payload.create({
      collection: 'roles',
      data: {
        name: role.name,
        description: 'description' in role ? role.description : undefined,
        permissions: role.permissions as Role['permissions'],
      },
    });
  }

  await payload.create({
    collection: 'users',
    data: devUser,
  });
});

afterAll(async () => {
  await payload?.destroy();
  await rm(databaseFile, { force: true });
});

describe('dev RBAC fixture', () => {
  it('seeds protected and editable example roles', async () => {
    const result = await payload.find({
      collection: 'roles',
      depth: 0,
      limit: 10,
      sort: 'name',
    });
    const roles = result.docs.map(({ name, permissions }) => ({
      name,
      permissions,
    }));

    expect(roles).toEqual([
      {
        name: 'Content Editor',
        permissions: [
          '*:read',
          'pages:create',
          'pages:update',
          'media:create',
          'media:update',
        ],
      },
      { name: devAdminRoleName, permissions: ['*'] },
      { name: 'Viewer', permissions: ['*:read'] },
    ]);
  });

  it('assigns the protected developer role to the auto-login user', async () => {
    const result = await payload.find({
      collection: 'users',
      depth: 1,
      limit: 1,
      where: {
        email: {
          equals: devUser.email,
        },
      },
    });
    const user = result.docs[0];
    const roleNames = Array.isArray(user?.roles)
      ? user.roles.flatMap((role) =>
          role &&
          typeof role === 'object' &&
          'name' in role &&
          typeof role.name === 'string'
            ? [role.name]
            : [],
        )
      : [];

    expect(roleNames).toContain(devAdminRoleName);
  });

  it('registers the localized permissions matrix client component', () => {
    const rolesCollection = payload.config.collections?.find(
      ({ slug }) => slug === 'roles',
    );
    const permissions = rolesCollection?.fields.find(
      (field): field is SelectField =>
        'name' in field &&
        field.name === 'permissions' &&
        field.type === 'select',
    );
    const fieldComponent = permissions?.admin?.components?.Field;
    const rows =
      fieldComponent &&
      typeof fieldComponent === 'object' &&
      'clientProps' in fieldComponent
        ? (
            fieldComponent.clientProps as {
              rows?: Array<{
                label: Record<string, string> | string;
                slug: string;
              }>;
            }
          ).rows
        : undefined;

    expect(fieldComponent).toMatchObject({ path: permissionsMatrixFieldPath });
    expect(rows?.find(({ slug }) => slug === 'categories')?.label).toEqual({
      en: 'Categories',
      ru: 'Категории',
      uk: 'Категорії',
    });
    expect(rows?.find(({ slug }) => slug === 'site-settings')?.label).toEqual({
      en: 'Site settings',
      ru: 'Настройки сайта',
      uk: 'Налаштування сайту',
    });
  });
});
