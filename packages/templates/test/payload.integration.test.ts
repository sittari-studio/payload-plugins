import { sqliteAdapter } from '@payloadcms/db-sqlite';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildConfig, getPayload, type Payload } from 'payload';

import {
  createTemplateGetter,
  templateField,
  templatesPlugin,
} from '../src/index.js';

const databaseFile = join(tmpdir(), `payload-templates-${randomUUID()}.sqlite`);
let payload: Payload;
let user: Record<string, unknown>;

beforeAll(async () => {
  const config = await buildConfig({
    secret: 'payload-templates-integration-secret',
    db: sqliteAdapter({
      client: { url: `file:${databaseFile}` },
      push: true,
      transactionOptions: {},
    }),
    localization: {
      defaultLocale: 'en',
      locales: ['en', 'uk'],
    },
    collections: [
      {
        slug: 'users',
        auth: true,
        fields: [],
      },
      {
        slug: 'pages',
        fields: [templateField({ name: 'content', template: '404' })],
      },
    ],
    plugins: [
      templatesPlugin({
        templates: [
          {
            name: '404',
            label: 'Page 404',
            fields: [
              { name: 'heading', type: 'text', required: true },
              {
                name: 'localizedHeading',
                type: 'text',
                localized: true,
                required: true,
              },
              { name: 'enabled', type: 'checkbox', required: true },
              { name: 'count', type: 'number', required: true },
              {
                name: 'nested',
                type: 'group',
                fields: [
                  { name: 'title', type: 'text', required: true },
                  { name: 'description', type: 'textarea' },
                ],
              },
              {
                name: 'items',
                type: 'array',
                fields: [{ name: 'label', type: 'text', required: true }],
              },
            ],
            initialData: {
              count: 7,
              enabled: true,
              heading: 'Page not found',
              localizedHeading: 'Localized page not found',
              items: [{ label: 'Default item' }],
              nested: {
                description: 'Default description',
                title: 'Default title',
              },
            },
          },
        ],
      }),
    ],
  });

  const userData = {
    email: 'editor@example.com',
    password: 'test-password',
  };
  payload = await getPayload({
    config,
    key: `templates-integration-${databaseFile}`,
  });
  user = (await payload.create({
    collection: 'users' as never,
    data: userData as never,
  })) as unknown as Record<string, unknown>;
});

afterAll(async () => {
  await payload.db.destroy?.();
  await rm(databaseFile, { force: true });
});

describe('real Payload template persistence', () => {
  type GeneratedTemplate = {
    id: number | string;
    title: string;
    templateType: string;
    data_404?: { heading?: string | null } | null;
  };

  it('seeds one managed document and remains idempotent', async () => {
    const initial = await payload.find({
      collection: 'templates' as never,
      depth: 0,
      limit: 0,
      pagination: false,
    });

    expect(initial.docs).toHaveLength(1);
    expect(initial.docs[0]).toMatchObject({
      title: 'Page 404',
      templateType: '404',
      data_404: { heading: 'Page not found' },
    });

    await payload.config.onInit?.(payload);

    expect(
      await payload.count({ collection: 'templates' as never }),
    ).toMatchObject({ totalDocs: 1 });
  });

  it('denies user create and delete operations while allowing content updates', async () => {
    const { docs } = await payload.find({
      collection: 'templates' as never,
      depth: 0,
      limit: 1,
    });
    const document = docs[0] as { id: number | string };

    const duplicateData = {
      data_404: { heading: 'Duplicate' },
      templateType: 'other',
      title: 'Other',
    };
    await expect(
      payload.create({
        collection: 'templates' as never,
        data: duplicateData as never,
        overrideAccess: false,
        user: user as never,
      }),
    ).rejects.toThrow();

    const updatedData = {
      data_404: { heading: 'Updated by user' },
      templateType: 'changed-by-user',
    };
    const updated = (await payload.update({
      collection: 'templates' as never,
      id: document.id,
      data: updatedData as never,
      overrideAccess: false,
      user: user as never,
    })) as unknown as { data_404: { heading: string }; templateType: string };

    expect(updated.data_404.heading).toBe('Updated by user');
    expect(updated.templateType).toBe('404');

    await expect(
      payload.delete({
        collection: 'templates' as never,
        id: document.id,
        overrideAccess: false,
        user: user as never,
      }),
    ).rejects.toThrow();
  });

  it('enforces templateType uniqueness at the database layer', async () => {
    const duplicateData = {
      data_404: { heading: 'Duplicate' },
      templateType: '404',
      title: 'Duplicate',
    };
    await expect(
      payload.create({
        collection: 'templates' as never,
        data: duplicateData as never,
        overrideAccess: true,
      }),
    ).rejects.toThrow();
  });

  it('inherits template values without persisting them into local overrides', async () => {
    const { docs } = await payload.find({
      collection: 'templates' as never,
      depth: 0,
      limit: 1,
    });
    const templateDocument = docs[0] as { id: number | string };

    const defaultsData = {
      data_404: {
        count: 7,
        enabled: true,
        heading: 'Default heading',
        localizedHeading: 'Localized default heading',
        items: [{ label: 'Default item' }],
        nested: {
          description: 'Default description',
          title: 'Default title',
        },
      },
    };
    await payload.update({
      collection: 'templates' as never,
      id: templateDocument.id,
      data: defaultsData as never,
      overrideAccess: true,
    });

    const pageContent = {
      content: {
        count: 0,
        enabled: false,
        heading: '',
        localizedHeading: '',
        items: [],
        nested: {
          description: 'Local description',
          title: null,
        },
      },
    };
    const created = (await payload.create({
      collection: 'pages' as never,
      data: pageContent as never,
    })) as unknown as {
      content: Record<string, unknown>;
      id: number | string;
    };

    expect(created.content).toMatchObject({
      count: 0,
      enabled: false,
      heading: 'Default heading',
      localizedHeading: 'Localized default heading',
      items: [{ label: 'Default item' }],
      nested: {
        description: 'Local description',
        title: 'Default title',
      },
    });

    const changedData = {
      data_404: {
        count: 9,
        enabled: true,
        heading: 'Changed default',
        localizedHeading: 'Changed localized default',
        items: [{ label: 'Changed default item' }],
        nested: {
          description: 'Changed default description',
          title: 'Changed default title',
        },
      },
    };
    await payload.update({
      collection: 'templates' as never,
      id: templateDocument.id,
      data: changedData as never,
      overrideAccess: true,
    });

    const inherited = (await payload.findByID({
      collection: 'pages' as never,
      id: created.id,
    })) as unknown as { content: Record<string, unknown> };

    expect(inherited.content).toMatchObject({
      count: 0,
      enabled: false,
      heading: 'Changed default',
      localizedHeading: 'Changed localized default',
      items: [{ label: 'Changed default item' }],
      nested: {
        description: 'Local description',
        title: 'Changed default title',
      },
    });

    const overrideData = {
      content: {
        heading: 'Local heading',
        items: [{ label: '' }],
      },
    };
    const overridden = (await payload.update({
      collection: 'pages' as never,
      id: created.id,
      data: overrideData as never,
    })) as unknown as { content: Record<string, unknown> };

    expect(overridden.content).toMatchObject({
      heading: 'Local heading',
      items: [{ label: '' }],
    });
  });

  it('fetches only the requested typed template group', async () => {
    const getTemplate = createTemplateGetter<GeneratedTemplate>(() => payload);

    const document = await getTemplate('404');

    expect(document).toMatchObject({
      data_404: { heading: expect.any(String) },
    });
    expect(document).toHaveProperty('id');
    expect(document).not.toHaveProperty('title');
    expect(document).not.toHaveProperty('templateType');
  });
});

it('fails initialization when a new template is missing required initial data', async () => {
  const invalidDatabaseFile = join(
    tmpdir(),
    `payload-templates-invalid-${randomUUID()}.sqlite`,
  );
  const config = await buildConfig({
    secret: 'payload-templates-invalid-integration-secret',
    db: sqliteAdapter({
      client: { url: `file:${invalidDatabaseFile}` },
      push: true,
      transactionOptions: {},
    }),
    collections: [],
    plugins: [
      templatesPlugin({
        templates: [
          {
            name: 'required',
            label: 'Required',
            fields: [{ name: 'heading', type: 'text', required: true }],
          },
        ],
      }),
    ],
  });

  await expect(
    getPayload({
      config,
      key: `templates-invalid-integration-${invalidDatabaseFile}`,
    }),
  ).rejects.toThrow();
  await rm(invalidDatabaseFile, { force: true });
});
