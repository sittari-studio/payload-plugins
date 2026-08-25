import { sqliteAdapter } from '@payloadcms/db-sqlite';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildConfig, getPayload, type Payload } from 'payload';

import {
  resolveSeoMetadata,
  renderSitemapXml,
  seoPlugin,
} from '../src/index.js';
import type { SeoDocument, SeoPayload } from '../src/types.js';

const databaseFile = join(tmpdir(), `payload-seo-${randomUUID()}.sqlite`);
let payload: Payload;

const seoPayload = (): SeoPayload => ({
  config: {
    custom: payload.config.custom,
    ...(payload.config.localization &&
    typeof payload.config.localization === 'object'
      ? {
          localization: {
            locales: payload.config.localization.locales.map(({ code }) => ({
              code,
            })),
          },
        }
      : {}),
  },
  findByID: async (options) =>
    payload.findByID({
      collection: 'pages',
      id: options.id as number,
      locale: options.locale as 'en' | 'fr',
      fallbackLocale: false,
      draft: false,
    }) as Promise<SeoDocument>,
  findGlobal: async (options) =>
    payload.findGlobal({
      slug: 'seo-settings',
      locale: options.locale as 'en' | 'fr',
      fallbackLocale: false,
      draft: false,
    }) as Promise<SeoDocument>,
  find: async (options) => {
    const result = await payload.find({
      collection: 'pages',
      locale: options.locale as 'en' | 'fr',
      fallbackLocale: false,
      draft: false,
      depth: 0,
      limit: options.limit as number,
      page: options.page as number | undefined,
      pagination: options.pagination as boolean | undefined,
    });
    return { docs: result.docs as SeoDocument[], totalDocs: result.totalDocs };
  },
});

beforeAll(async () => {
  const config = await buildConfig({
    secret: 'payload-seo-integration-secret',
    db: sqliteAdapter({
      client: { url: `file:${databaseFile}` },
      push: true,
      transactionOptions: {},
    }),
    localization: {
      defaultLocale: 'en',
      fallback: false,
      locales: [
        { code: 'en', label: 'English' },
        { code: 'fr', label: 'Français' },
      ],
    },
    collections: [
      {
        slug: 'media',
        fields: [{ name: 'url', type: 'text', required: true }],
      },
      {
        slug: 'pages',
        versions: { drafts: true },
        fields: [
          { name: 'title', type: 'text', required: true, localized: true },
          { name: 'slug', type: 'text', required: true, localized: true },
          { name: 'description', type: 'textarea', localized: true },
          { name: 'image', type: 'relationship', relationTo: 'media' },
        ],
      },
    ],
    plugins: [
      seoPlugin({
        siteUrl: 'https://example.com',
        collections: {
          pages: {
            fields: {
              title: 'title',
              description: 'description',
              image: 'image',
            },
          },
        },
        media: {
          collection: 'media',
          resolveMediaUrl: ({ media }) =>
            typeof media.url === 'string' ? media.url : null,
        },
        resolveUrl: ({ document }) =>
          typeof document.slug === 'string' ? `/${document.slug}` : null,
        resolveChunkUrl: ({ locale, page }) =>
          `https://example.com/sitemaps/${locale}/${page}.xml`,
      }),
    ],
  });
  payload = await getPayload({
    config,
    key: `seo-integration-${databaseFile}`,
  });
});

afterAll(async () => {
  await payload.db.destroy?.();
  await rm(databaseFile, { force: true });
});

describe('real Payload SEO persistence', () => {
  it('persists and resolves a custom schema owned by one document', async () => {
    const page = await payload.create({
      collection: 'pages',
      locale: 'en',
      data: {
        title: 'One-off',
        slug: 'one-off',
        seo: {
          documentSchemas: [
            {
              schemaId: 'one-off-schema',
              name: 'One-off thing',
              schema: {
                '@type': 'Thing',
                name: '$title',
                url: '$canonicalUrl',
              },
            },
          ],
        },
      },
    });
    const saved = await payload.findByID({
      collection: 'pages',
      id: page.id,
      locale: 'en',
      fallbackLocale: false,
      draft: false,
    });
    expect(saved.seo?.documentSchemas).toMatchObject([
      { schemaId: 'one-off-schema', name: 'One-off thing' },
    ]);
    expect(
      (
        await resolveSeoMetadata({
          payload: seoPayload(),
          collection: 'pages',
          id: page.id,
          locale: 'en',
        })
      ).schema,
    ).toMatchObject({
      '@type': 'Thing',
      name: 'One-off',
      url: 'https://example.com/one-off',
    });
  });

  it('seeds every current default, keeps repeated references, and cascades template deletion', async () => {
    await payload.updateGlobal({
      slug: 'seo-settings',
      locale: 'en',
      data: {
        collectionSchemas: [
          {
            collection: 'pages',
            templates: [
              {
                templateId: 'page',
                name: 'Page',
                schema: { '@type': 'WebPage', name: '$title' },
                isDefault: true,
              },
              {
                templateId: 'thing',
                name: 'Thing',
                schema: { '@type': 'Thing', name: '$title' },
                isDefault: true,
              },
            ],
          },
        ],
      },
    });
    const seeded = await payload.create({
      collection: 'pages',
      locale: 'en',
      data: { title: 'Seeded', slug: 'seeded' },
    });
    expect(
      seeded.seo?.schemaInstances?.map(
        (item: { templateId: string }) => item.templateId,
      ),
    ).toEqual(['page', 'thing']);

    const repeated = await payload.create({
      collection: 'pages',
      locale: 'en',
      data: {
        title: 'Repeated',
        slug: 'repeated',
        seo: {
          schemaInstances: [{ templateId: 'page' }, { templateId: 'page' }],
        },
      },
    });
    expect(repeated.seo?.schemaInstances).toHaveLength(2);

    const explicitlyEmpty = await payload.create({
      collection: 'pages',
      locale: 'en',
      data: {
        title: 'No schemas',
        slug: 'no-schemas',
        seo: { schemaInstances: [] },
      },
    });
    expect(explicitlyEmpty.seo?.schemaInstances).toEqual([]);

    const metadata = await resolveSeoMetadata({
      payload: seoPayload(),
      collection: 'pages',
      id: seeded.id,
      locale: 'en',
    });
    expect(metadata.schema?.['@graph']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ '@type': 'WebPage', name: 'Seeded' }),
        expect.objectContaining({ '@type': 'Thing', name: 'Seeded' }),
      ]),
    );

    await payload.updateGlobal({
      slug: 'seo-settings',
      locale: 'en',
      data: { collectionSchemas: [] },
    });
    const cascadedSeeded = await payload.findByID({
      collection: 'pages',
      id: seeded.id,
      locale: 'en',
      fallbackLocale: false,
      draft: true,
    });
    const cascadedRepeated = await payload.findByID({
      collection: 'pages',
      id: repeated.id,
      locale: 'en',
      fallbackLocale: false,
      draft: true,
    });
    expect(cascadedSeeded.seo?.schemaInstances).toEqual([]);
    expect(cascadedRepeated.seo?.schemaInstances).toEqual([]);
    expect(
      (
        await resolveSeoMetadata({
          payload: seoPayload(),
          collection: 'pages',
          id: seeded.id,
          locale: 'en',
        })
      ).schema,
    ).toBeUndefined();
  });

  it('persists inherit-by-default robots and applies a saved global noindex default after reload', async () => {
    const page = await payload.create({
      collection: 'pages',
      locale: 'en',
      data: { title: 'Inherited', slug: 'inherited' },
    });
    const saved = await payload.findByID({
      collection: 'pages',
      id: page.id,
      locale: 'en',
      fallbackLocale: false,
      draft: false,
    });
    expect(saved.seo?.robots?.mode).toBe('inherit');

    await payload.updateGlobal({
      slug: 'seo-settings',
      locale: 'en',
      data: { defaultRobots: { mode: 'noindex-follow' } },
    });
    const metadata = await resolveSeoMetadata({
      payload: seoPayload(),
      collection: 'pages',
      id: page.id,
      locale: 'en',
    });
    expect(metadata.robots).toMatchObject({
      index: 'noindex',
      follow: 'follow',
    });

    const reloaded = await payload.findByID({
      collection: 'pages',
      id: page.id,
      locale: 'en',
      fallbackLocale: false,
      draft: false,
    });
    expect(reloaded.seo?.robots?.mode).toBe('inherit');
  });

  it('persists localized keywords and switches between appending and overriding defaults', async () => {
    await payload.updateGlobal({
      slug: 'seo-settings',
      locale: 'en',
      data: { defaultKeywords: ' payload, cms ' },
    });
    const page = await payload.create({
      collection: 'pages',
      locale: 'en',
      data: {
        title: 'Keywords',
        slug: 'keywords',
        seo: { focusKeyword: ' plugin, next.js ', overrideKeywords: false },
      },
    });

    expect(
      (
        await resolveSeoMetadata({
          payload: seoPayload(),
          collection: 'pages',
          id: page.id,
          locale: 'en',
        })
      ).keywords,
    ).toBe('payload,cms,plugin,next.js');

    await payload.update({
      collection: 'pages',
      id: page.id,
      locale: 'en',
      data: { seo: { focusKeyword: ' custom, only ', overrideKeywords: true } },
    });
    expect(
      (
        await resolveSeoMetadata({
          payload: seoPayload(),
          collection: 'pages',
          id: page.id,
          locale: 'en',
        })
      ).keywords,
    ).toBe('custom,only');
  });

  it('persists explicit robots and all canonical modes', async () => {
    const page = await payload.create({
      collection: 'pages',
      locale: 'en',
      data: {
        title: 'Manual',
        slug: 'manual',
        seo: {
          robots: { mode: 'index-follow' },
          canonical: { mode: 'manual', url: 'https://example.com/preferred' },
        },
      },
    });
    const manual = await payload.findByID({
      collection: 'pages',
      id: page.id,
      locale: 'en',
      fallbackLocale: false,
      draft: false,
    });
    expect(manual.seo?.robots?.mode).toBe('index-follow');
    expect(manual.seo?.canonical).toMatchObject({
      mode: 'manual',
      url: 'https://example.com/preferred',
    });
    expect(
      (
        await resolveSeoMetadata({
          payload: seoPayload(),
          collection: 'pages',
          id: page.id,
          locale: 'en',
        })
      ).canonicalUrl,
    ).toBe('https://example.com/preferred');

    await payload.update({
      collection: 'pages',
      id: page.id,
      locale: 'en',
      data: { seo: { canonical: { mode: 'none' } } },
    });
    const none = await payload.findByID({
      collection: 'pages',
      id: page.id,
      locale: 'en',
      fallbackLocale: false,
      draft: false,
    });
    expect(none.seo?.canonical?.mode).toBe('none');
    expect(
      (
        await resolveSeoMetadata({
          payload: seoPayload(),
          collection: 'pages',
          id: page.id,
          locale: 'en',
        })
      ).canonicalUrl,
    ).toBeUndefined();
  });

  it('persists independent localized values and excludes drafts from the final sitemap', async () => {
    await payload.updateGlobal({
      slug: 'seo-settings',
      locale: 'en',
      data: { defaultRobots: { mode: 'index-follow' } },
    });
    const published = await payload.create({
      collection: 'pages',
      locale: 'en',
      data: { title: 'English', slug: 'english', _status: 'published' },
    });
    await payload.update({
      collection: 'pages',
      id: published.id,
      locale: 'fr',
      data: { title: 'Français', slug: 'francais', _status: 'published' },
    });
    const english = await payload.findByID({
      collection: 'pages',
      id: published.id,
      locale: 'en',
      fallbackLocale: false,
      draft: false,
    });
    const french = await payload.findByID({
      collection: 'pages',
      id: published.id,
      locale: 'fr',
      fallbackLocale: false,
      draft: false,
    });
    expect(english.slug).toBe('english');
    expect(french.slug).toBe('francais');

    await payload.create({
      collection: 'pages',
      locale: 'en',
      data: { title: 'Draft', slug: 'draft', _status: 'draft' },
      draft: true,
    });
    const sitemap = await renderSitemapXml({
      payload: seoPayload(),
      collection: 'pages',
      locale: 'en',
      page: 1,
    });
    expect(sitemap).toContain('<loc>https://example.com/english</loc>');
    expect(sitemap).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    expect(sitemap).toContain(
      '<xhtml:link rel="alternate" hreflang="fr" href="https://example.com/francais"/>',
    );
    expect(sitemap).not.toContain('<loc>https://example.com/draft</loc>');
  });

  it('passes persisted Media relationships through the production resolver for metadata and global schemas', async () => {
    const image = await payload.create({
      collection: 'media',
      data: { url: 'https://cdn.example/persisted.jpg' },
    });
    await payload.updateGlobal({
      slug: 'seo-settings',
      locale: 'en',
      data: {
        defaultRobots: { mode: 'index-follow' },
        globalSchemas: [
          {
            templateId: 'org',
            name: 'Organization',
            schema: { '@type': 'Organization', name: 'Persisted Organization' },
          },
        ],
      },
    });
    const page = await payload.create({
      collection: 'pages',
      locale: 'en',
      data: { title: 'Image', slug: 'image', image: image.id },
    });
    const metadata = await resolveSeoMetadata({
      payload: seoPayload(),
      collection: 'pages',
      id: page.id,
      locale: 'en',
    });
    expect(metadata.openGraph?.image).toBe('https://cdn.example/persisted.jpg');
    expect(metadata.schema).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Persisted Organization',
    });

    await payload.update({
      collection: 'pages',
      id: page.id,
      locale: 'en',
      data: {
        seo: {
          globalSchemaOverrides: [
            {
              schemaId: 'org',
              overrides: [
                { op: 'replace', path: '/name', value: 'Page Organization' },
              ],
            },
          ],
        },
      },
    });
    await payload.updateGlobal({
      slug: 'seo-settings',
      locale: 'en',
      data: { globalSchemas: [] },
    });
    const cascaded = await payload.findByID({
      collection: 'pages',
      id: page.id,
      locale: 'en',
      fallbackLocale: false,
      draft: true,
    });
    expect(cascaded.seo?.globalSchemaOverrides).toEqual([]);
  });

  it('rejects invalid persisted schema, robots, and canonical values through generated Payload fields', async () => {
    const data = { title: 'Invalid', slug: 'invalid' };
    await expect(
      payload.updateGlobal({
        slug: 'seo-settings',
        locale: 'en',
        data: {
          globalSchemas: [
            { templateId: 'bad', name: 'Bad', schema: [] as unknown as never },
          ],
        },
      }),
    ).rejects.toThrow();
    await expect(
      payload.create({
        collection: 'pages',
        locale: 'en',
        data: {
          title: 'Bad custom schema',
          slug: 'bad-custom-schema',
          seo: {
            documentSchemas: [
              {
                schemaId: 'bad',
                name: 'Bad',
                schema: [] as unknown as never,
              },
            ],
          },
        },
      }),
    ).rejects.toThrow();
    await expect(
      payload.updateGlobal({
        slug: 'seo-settings',
        locale: 'en',
        data: {
          globalSchemas: [
            {
              templateId: 'duplicate',
              name: 'First',
              schema: { '@type': 'Thing' },
            },
            {
              templateId: 'duplicate',
              name: 'Second',
              schema: { '@type': 'Thing' },
            },
          ],
        },
      }),
    ).rejects.toThrow('must be unique');
    await expect(
      payload.create({
        collection: 'pages',
        locale: 'en',
        data: {
          ...data,
          slug: 'invalid-canonical',
          seo: { canonical: { mode: 'manual', url: 'javascript:alert(1)' } },
        },
      }),
    ).rejects.toThrow();
    await expect(
      payload.updateGlobal({
        slug: 'seo-settings',
        locale: 'en',
        data: {
          robots: { mode: 'generated', groups: [{ userAgent: 'bad\nagent' }] },
        },
      }),
    ).rejects.toThrow();
  });
});
