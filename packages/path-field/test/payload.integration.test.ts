import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { nestedDocsPlugin } from '@payloadcms/plugin-nested-docs'
import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildConfig, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createPathHelpers, pathFieldPlugin } from '../src/index.js'

const databaseFile = join(tmpdir(), `payload-path-field-${randomUUID()}.sqlite`)
let payload: Payload
const nestedDatabaseFile = join(
  tmpdir(),
  `payload-path-field-nested-${randomUUID()}.sqlite`,
)
let nestedPayload: Payload

beforeAll(async () => {
  const config = await buildConfig({
    secret: 'payload-path-field-integration-secret',
    db: sqliteAdapter({
      client: { url: `file:${databaseFile}` },
      push: true,
      transactionOptions: {},
    }),
    localization: {
      defaultLocale: 'en',
      fallback: false,
      locales: ['en', 'uk'],
    },
    collections: [
      {
        slug: 'pages',
        access: { read: () => true },
        fields: [
          {
            name: 'slug',
            type: 'text',
            localized: true,
            required: true,
          },
        ],
      },
    ],
    plugins: [
      pathFieldPlugin({
        collections: { pages: true },
        resolveDocumentUrl: ({ doc, locale }) =>
          `/${locale}/${String(doc.slug)}`,
      }),
    ],
  })
  payload = await getPayload({
    config,
    key: `path-field-integration-${databaseFile}`,
  })

  const nestedConfig = await buildConfig({
    secret: 'payload-path-field-nested-integration-secret',
    db: sqliteAdapter({
      client: { url: `file:${nestedDatabaseFile}` },
      push: true,
      transactionOptions: {},
    }),
    localization: {
      defaultLocale: 'en',
      fallback: false,
      locales: ['en', 'uk'],
    },
    collections: [
      {
        slug: 'categories',
        access: { read: () => true },
        fields: [
          {
            name: 'slug',
            type: 'text',
            localized: true,
            required: true,
          },
          {
            name: 'ancestor',
            type: 'relationship',
            relationTo: 'categories',
          },
        ],
      },
    ],
    plugins: [
      nestedDocsPlugin({
        collections: ['categories'],
        parentFieldSlug: 'ancestor',
      }),
      pathFieldPlugin({
        collections: {
          categories: { parentField: 'ancestor' },
        },
        resolveDocumentUrl: ({ doc, locale }) => {
          const parent =
            doc.ancestor &&
            typeof doc.ancestor === 'object' &&
            'path' in doc.ancestor
              ? doc.ancestor.path
              : undefined
          return `${typeof parent === 'string' ? parent : `/${locale}`}/${String(doc.slug)}`
        },
      }),
    ],
  })
  nestedPayload = await getPayload({
    config: nestedConfig,
    key: `path-field-nested-integration-${nestedDatabaseFile}`,
  })
})

afterAll(async () => {
  await payload.db.destroy?.()
  await nestedPayload.db.destroy?.()
  await rm(databaseFile, { force: true })
  await rm(nestedDatabaseFile, { force: true })
})

describe('nested-docs integration in supported plugin order', () => {
  it('populates custom parents and propagates ancestor path changes', async () => {
    const root = await nestedPayload.create({
      collection: 'categories',
      data: { slug: 'catalog' },
      locale: 'en',
    })
    const child = await nestedPayload.create({
      collection: 'categories',
      data: {
        ancestor: root.id,
        slug: 'shoes',
      },
      locale: 'en',
    })
    const grandchild = await nestedPayload.create({
      collection: 'categories',
      data: {
        ancestor: child.id,
        slug: 'boots',
      },
      locale: 'en',
    })

    expect(child.path).toBe('/en/catalog/shoes')
    expect(grandchild.path).toBe('/en/catalog/shoes/boots')

    // Seed every level in the second locale before asking nested-docs to
    // cascade an ancestor update through that locale.
    await nestedPayload.update({
      collection: 'categories',
      data: { slug: 'cherevyky' },
      fallbackLocale: false,
      id: grandchild.id,
      locale: 'uk',
    })
    await nestedPayload.update({
      collection: 'categories',
      data: { slug: 'vzuttya' },
      fallbackLocale: false,
      id: child.id,
      locale: 'uk',
    })
    await nestedPayload.update({
      collection: 'categories',
      data: { slug: 'katalog' },
      fallbackLocale: false,
      id: root.id,
      locale: 'uk',
    })

    await nestedPayload.update({
      collection: 'categories',
      data: { slug: 'products' },
      id: root.id,
      locale: 'en',
    })
    const updatedGrandchild = await nestedPayload.findByID({
      collection: 'categories',
      fallbackLocale: false,
      id: grandchild.id,
      locale: 'en',
    })
    expect(updatedGrandchild.path).toBe('/en/products/shoes/boots')

    await nestedPayload.update({
      collection: 'categories',
      data: { slug: 'kataloh' },
      fallbackLocale: false,
      id: root.id,
      locale: 'uk',
    })
    const englishGrandchild = await nestedPayload.findByID({
      collection: 'categories',
      fallbackLocale: false,
      id: grandchild.id,
      locale: 'en',
    })
    expect(englishGrandchild.path).toBe('/en/products/shoes/boots')
  })
})

describe('startup backfill', () => {
  it('fills paths for documents created before the plugin was installed', async () => {
    const backfillDatabaseFile = join(
      tmpdir(),
      `payload-path-field-backfill-${randomUUID()}.sqlite`,
    )
    const database = () =>
      sqliteAdapter({
        client: { url: `file:${backfillDatabaseFile}` },
        push: true,
        transactionOptions: {},
      })
    const collection = () => ({
      slug: 'articles',
      versions: { drafts: true },
      fields: [
        {
          name: 'slug',
          type: 'text' as const,
          localized: true,
          required: true,
        },
      ],
    })

    const oldConfig = await buildConfig({
      secret: 'payload-path-field-backfill-secret',
      db: database(),
      localization: {
        defaultLocale: 'en',
        fallback: false,
        locales: ['en', 'uk'],
      },
      collections: [collection()],
    })
    const oldPayload = await getPayload({
      config: oldConfig,
      key: `path-field-backfill-old-${backfillDatabaseFile}`,
    })
    const published = await oldPayload.create({
      collection: 'articles',
      data: { _status: 'published', slug: 'news' },
      locale: 'en',
    })
    await oldPayload.update({
      collection: 'articles',
      data: { _status: 'published', slug: 'novyny' },
      id: published.id,
      locale: 'uk',
    })
    const draft = await oldPayload.create({
      collection: 'articles',
      data: { _status: 'draft', slug: 'preview' },
      draft: true,
      locale: 'en',
    })
    await oldPayload.update({
      collection: 'articles',
      data: { _status: 'draft', slug: 'poperednii' },
      draft: true,
      id: draft.id,
      locale: 'uk',
    })
    await oldPayload.db.destroy?.()

    const newConfig = await buildConfig({
      secret: 'payload-path-field-backfill-secret',
      db: database(),
      localization: {
        defaultLocale: 'en',
        fallback: false,
        locales: ['en', 'uk'],
      },
      collections: [collection()],
      plugins: [
        pathFieldPlugin({
          collections: { articles: true },
          resolveDocumentUrl: ({ doc, locale }) =>
            `/${locale}/${String(doc.slug)}`,
        }),
      ],
    })
    const backfilledPayload = await getPayload({
      config: newConfig,
      key: `path-field-backfill-new-${backfillDatabaseFile}`,
    })

    const englishPublished = await backfilledPayload.findByID({
      collection: 'articles',
      draft: false,
      fallbackLocale: false,
      id: published.id,
      locale: 'en',
    })
    const ukrainianPublished = await backfilledPayload.findByID({
      collection: 'articles',
      draft: false,
      fallbackLocale: false,
      id: published.id,
      locale: 'uk',
    })
    const currentDraft = await backfilledPayload.findByID({
      collection: 'articles',
      draft: true,
      fallbackLocale: false,
      id: draft.id,
      locale: 'en',
    })

    expect(englishPublished.path).toBe('/en/news')
    expect(ukrainianPublished.path).toBe('/uk/novyny')
    expect(currentDraft.path).toBe('/en/preview')

    await backfilledPayload.db.destroy?.()
    await rm(backfillDatabaseFile, { force: true })
  })
})

describe('real Payload path field behavior', () => {
  it('stores localized generated paths and prevents client overrides', async () => {
    const created = await payload.create({
      collection: 'pages',
      data: {
        path: '/client-value',
        slug: 'about',
      } as never,
      locale: 'en',
    }) as unknown as { id: number | string; path?: string }
    expect(created.path).toBe('/en/about')

    const updated = await payload.update({
      collection: 'pages',
      data: {
        path: '/another-client-value',
        slug: 'pro-nas',
      } as never,
      fallbackLocale: false,
      id: created.id,
      locale: 'uk',
    }) as unknown as { path?: string }
    expect(updated.path).toBe('/uk/pro-nas')

    const english = await payload.findByID({
      collection: 'pages',
      fallbackLocale: false,
      id: created.id,
      locale: 'en',
    }) as unknown as { path?: string }
    expect(english.path).toBe('/en/about')
  })

  it('resolves canonical and paginated paths with exact-document precedence', async () => {
    await payload.create({
      collection: 'pages',
      data: { slug: 'catalog' },
      locale: 'en',
    })
    const exactPageDocument = await payload.create({
      collection: 'pages',
      data: { slug: 'catalog/page/2' },
      locale: 'en',
    })
    const paths = createPathHelpers({ getPayload: () => payload })

    const base = await paths.findDocumentByPath({
      locale: 'en',
      pagination: true,
      path: '/en/catalog',
    })
    expect(base?.route).toEqual({
      canonicalPath: '/en/catalog',
      isCanonical: true,
      page: 1,
    })

    const pageOne = await paths.findDocumentByPath({
      locale: 'en',
      pagination: true,
      path: '/en/catalog/page/1',
    })
    expect(pageOne?.route).toEqual({
      canonicalPath: '/en/catalog',
      isCanonical: false,
      page: 1,
    })

    const exact = await paths.findDocumentByPath({
      locale: 'en',
      pagination: true,
      path: '/en/catalog/page/2',
    })
    expect(exact?.document.id).toBe(exactPageDocument.id)
    expect(exact?.route?.page).toBe(1)

    const pageThree = await paths.findDocumentByPath({
      locale: 'en',
      pagination: true,
      path: '/en/catalog/page/3',
    })
    expect(pageThree?.route).toEqual({
      canonicalPath: '/en/catalog/page/3',
      isCanonical: true,
      page: 3,
    })
  })
})
