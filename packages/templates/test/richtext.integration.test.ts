import { sqliteAdapter } from '@payloadcms/db-sqlite';
import { BlocksFeature, lexicalEditor } from '@payloadcms/richtext-lexical';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildConfig, getPayload, type Payload } from 'payload';

import { templateField, templatesPlugin } from '../src/index.js';

const databaseFile = join(
  tmpdir(),
  `payload-templates-richtext-${randomUUID()}.sqlite`,
);

const richTextWithCta = (title: string) => ({
  root: {
    children: [
      {
        children: [],
        direction: null,
        fields: {
          blockType: 'postCta',
          cta: { title: { uk: title } },
        },
        format: '',
        indent: 0,
        type: 'block',
        version: 2,
      },
    ],
    direction: null,
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
});

let payload: Payload;
let postID: number | string;

beforeAll(async () => {
  const config = await buildConfig({
    secret: 'payload-templates-richtext-integration-secret',
    db: sqliteAdapter({
      client: { url: `file:${databaseFile}` },
      push: true,
      transactionOptions: {},
    }),
    blocks: [
      {
        slug: 'postCta',
        fields: [
          {
            name: 'disabled',
            type: 'checkbox',
            defaultValue: false,
          },
          {
            type: 'group',
            fields: [
              templateField({
                name: 'cta',
                template: 'cta',
              }),
            ],
          },
        ],
      },
    ],
    collections: [
      {
        slug: 'posts',
        fields: [
          { name: 'title', type: 'text', required: true },
          {
            type: 'tabs',
            tabs: [
              {
                label: 'Post',
                fields: [
                  {
                    name: 'content',
                    type: 'richText',
                    localized: true,
                    editor: lexicalEditor({
                      features: ({ defaultFeatures }) => [
                        ...defaultFeatures,
                        BlocksFeature({ blocks: ['postCta'] }),
                      ],
                    }),
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    localization: {
      defaultLocale: 'en',
      locales: ['en', 'uk'],
    },
    plugins: [
      templatesPlugin({
        templates: [
          {
            name: 'cta',
            label: 'CTA',
            fields: [
              {
                name: 'title',
                type: 'text',
                localized: true,
              },
            ],
          },
        ],
      }),
    ],
  });

  payload = await getPayload({
    config,
    key: `templates-richtext-integration-${databaseFile}`,
  });

  const template = await payload.find({
    collection: 'templates' as never,
    fallbackLocale: false,
    locale: 'all',
    limit: 1,
    pagination: false,
  });
  const templateID = (template.docs[0] as { id: number | string }).id;

  await payload.update({
    collection: 'templates' as never,
    id: templateID,
    data: { data_cta: { title: 'English title' } } as never,
    fallbackLocale: false,
    locale: 'en',
  });
  await payload.update({
    collection: 'templates' as never,
    id: templateID,
    data: { data_cta: { title: 'Ukrainian title' } } as never,
    fallbackLocale: false,
    locale: 'uk',
  });

  const post = await payload.create({
    collection: 'posts',
    data: {
      content: richTextWithCta(''),
      title: 'Localized CTA post',
    } as never,
    fallbackLocale: false,
    locale: 'en',
  });
  postID = post.id;

  await payload.update({
    collection: 'posts',
    id: postID,
    data: { content: richTextWithCta('') } as never,
    fallbackLocale: false,
    locale: 'uk',
  });
});

afterAll(async () => {
  await payload.db.destroy?.();
  await rm(databaseFile, { force: true });
});

describe('localized Rich Text template fields', () => {
  it('resolves template descendants for the Rich Text locale', async () => {
    const ukDocument = (await payload.findByID({
      collection: 'posts',
      context: { templateFields: 'resolved' },
      fallbackLocale: false,
      id: postID,
      locale: 'uk',
    })) as any;
    const enDocument = (await payload.findByID({
      collection: 'posts',
      context: { templateFields: 'resolved' },
      fallbackLocale: false,
      id: postID,
      locale: 'en',
    })) as any;

    expect(ukDocument.content.root.children[0].fields.cta.title).toBe(
      'Ukrainian title',
    );
    expect(enDocument.content.root.children[0].fields.cta.title).toBe(
      'English title',
    );
  });

  it('keeps localized Rich Text block values scalar for locale-all reads', async () => {
    const document = (await payload.findByID({
      collection: 'posts',
      context: { templateFields: 'resolved' },
      fallbackLocale: false,
      id: postID,
      locale: 'all',
    })) as any;

    expect(document.content.en.root.children[0].fields.cta.title).toBe(
      'English title',
    );
    expect(document.content.uk.root.children[0].fields.cta.title).toBe(
      'Ukrainian title',
    );
  });
});
