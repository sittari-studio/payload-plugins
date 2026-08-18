import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { nestedDocsPlugin } from '@payloadcms/plugin-nested-docs'
import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildConfig, getPayload, type Payload, ValidationError } from 'payload'
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
        trash: true,
        versions: {
          drafts: { autosave: true },
        },
        fields: [
          {
            name: 'slug',
            type: 'text',
            localized: true,
            required: true,
          },
        ],
      },
      {
        slug: 'posts',
        access: { read: () => true },
        versions: { drafts: true },
        fields: [
          {
            name: 'slug',
            type: 'text',
            required: true,
          },
        ],
      },
      {
        slug: 'private-pages',
        access: { read: () => false },
        versions: { drafts: true },
        fields: [
          {
            name: 'slug',
            type: 'text',
            required: true,
          },
        ],
      },
    ],
    plugins: [
      pathFieldPlugin({
        collections: { pages: true, posts: true, 'private-pages': true },
        resolveDocumentUrl: ({ doc, locale }) =>
          doc.slug === 'unresolved'
            ? null
            : `/${locale}/${String(doc.slug)}`,
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
    const collection = (requiredLocalizedField = false) => ({
      slug: 'articles',
      versions: { drafts: true },
      fields: [
        {
          name: 'slug',
          type: 'text' as const,
          localized: true,
          required: true,
        },
        {
          name: 'requiredLocalizedField',
          type: 'text' as const,
          localized: true,
          required: requiredLocalizedField,
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
      data: {
        _status: 'published',
        requiredLocalizedField: 'English value',
        slug: 'news',
      },
      locale: 'en',
    })
    await oldPayload.update({
      collection: 'articles',
      data: {
        _status: 'published',
        requiredLocalizedField: 'Ukrainian value',
        slug: 'novyny',
      },
      id: published.id,
      locale: 'uk',
    })
    const draft = await oldPayload.create({
      collection: 'articles',
      data: {
        _status: 'draft',
        requiredLocalizedField: 'English draft value',
        slug: 'preview',
      },
      draft: true,
      locale: 'en',
    })
    await oldPayload.update({
      collection: 'articles',
      data: {
        _status: 'draft',
        requiredLocalizedField: 'Ukrainian draft value',
        slug: 'poperednii',
      },
      draft: true,
      id: draft.id,
      locale: 'uk',
    })
    const invalid = await oldPayload.create({
      collection: 'articles',
      data: {
        _status: 'published',
        requiredLocalizedField: 'Only an English value',
        slug: 'legacy',
      },
      locale: 'en',
    })
    await oldPayload.update({
      collection: 'articles',
      data: { _status: 'published', slug: 'zastarilyi' },
      id: invalid.id,
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
      collections: [collection(true)],
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
    const ukrainianDraft = await backfilledPayload.findByID({
      collection: 'articles',
      draft: true,
      fallbackLocale: false,
      id: draft.id,
      locale: 'uk',
    })
    const invalidUkrainian = await backfilledPayload.findByID({
      collection: 'articles',
      draft: false,
      fallbackLocale: false,
      id: invalid.id,
      locale: 'uk',
    })
    const routes = await backfilledPayload.find({
      collection: 'path-routes' as never,
      limit: 100,
      overrideAccess: true,
    })

    expect(englishPublished.path).toBe('/en/news')
    expect(ukrainianPublished.path).toBe('/uk/novyny')
    expect(currentDraft.path).toBe('/en/preview')
    expect(ukrainianDraft.path).toBe('/uk/poperednii')
    expect(invalidUkrainian.path).toBeNull()
    expect(routes.docs.map((route) => route.path)).not.toEqual(
      expect.arrayContaining(['/en/preview', '/uk/poperednii']),
    )

    await backfilledPayload.db.destroy?.()
    await rm(backfillDatabaseFile, { force: true })
  })
})

describe('real Payload path field behavior', () => {
  it('allows creation without a path, then rejects updates until one resolves', async () => {
    const created = await payload.create({
      collection: 'pages',
      data: { slug: 'unresolved' },
      draft: true,
      locale: 'en',
    }) as unknown as { id: number | string; path?: null | string }
    expect(created.path).toBeNull()

    const autosaved = await payload.update({
      autosave: true,
      collection: 'pages',
      data: { slug: 'unresolved' },
      draft: true,
      id: created.id,
      locale: 'en',
    }) as unknown as { path?: null | string }
    expect(autosaved.path).toBeNull()

    const draftSaved = await payload.update({
      collection: 'pages',
      data: { slug: 'unresolved' },
      draft: true,
      id: created.id,
      locale: 'en',
    }) as unknown as { path?: null | string }
    expect(draftSaved.path).toBeNull()

    const update = payload.update({
      collection: 'pages',
      data: { slug: 'unresolved' },
      id: created.id,
      locale: 'en',
    })
    await expect(update).rejects.toBeInstanceOf(ValidationError)
    await expect(update).rejects.toMatchObject({
      data: {
        collection: 'pages',
        errors: [
          {
            message: 'Path must be a non-empty string.',
            path: 'path',
          },
        ],
      },
      status: 400,
    })

    const resolved = await payload.update({
      collection: 'pages',
      data: { slug: 'resolved' },
      id: created.id,
      locale: 'en',
    }) as unknown as { path?: null | string }
    expect(resolved.path).toBe('/en/resolved')
  })

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
      data: { _status: 'published', slug: 'catalog' },
      locale: 'en',
    })
    const exactPageDocument = await payload.create({
      collection: 'pages',
      data: { _status: 'published', slug: 'catalog/page/2' },
      locale: 'en',
    })
    const paths = createPathHelpers({ getPayload: () => payload })

    const base = await paths.findDocumentByPath({
      path: '/en/catalog',
    })
    expect(base?.route).toEqual({
      canonicalPath: '/en/catalog',
      isCanonical: true,
      page: 1,
    })

    const pageOne = await paths.findDocumentByPath({
      path: '/en/catalog/page/1',
    })
    expect(pageOne?.route).toEqual({
      canonicalPath: '/en/catalog',
      isCanonical: false,
      page: 1,
    })

    const exact = await paths.findDocumentByPath({
      path: '/en/catalog/page/2',
    })
    expect(exact?.document.id).toBe(exactPageDocument.id)
    expect(exact?.route?.page).toBe(1)

    const pageThree = await paths.findDocumentByPath({
      path: '/en/catalog/page/3',
    })
    expect(pageThree?.route).toEqual({
      canonicalPath: '/en/catalog/page/3',
      isCanonical: true,
      page: 3,
    })
  })

  it('synchronizes published routes through the document lifecycle', async () => {
    const draft = await payload.create({
      collection: 'pages',
      data: { slug: 'lifecycle' },
      draft: true,
      locale: 'en',
    })
    const paths = createPathHelpers({ getPayload: () => payload })

    expect(await paths.findDocumentByPath({ path: '/en/lifecycle' })).toBeNull()

    await payload.update({
      collection: 'pages',
      data: { _status: 'published' },
      draft: true,
      id: draft.id,
      locale: 'en',
    })
    expect((await paths.findDocumentByPath({ path: '/en/lifecycle' }))?.document.id).toBe(
      draft.id,
    )

    await payload.update({
      collection: 'pages',
      data: { slug: 'lifecycle-moved' },
      id: draft.id,
      locale: 'en',
    })
    expect(await paths.findDocumentByPath({ path: '/en/lifecycle' })).toBeNull()
    expect(
      (await paths.findDocumentByPath({ path: '/en/lifecycle-moved' }))?.document.id,
    ).toBe(draft.id)

    await payload.update({
      collection: 'pages',
      data: { slug: 'lifecycle-selected' },
      id: draft.id,
      locale: 'en',
      select: { id: true },
    })
    expect(await paths.findDocumentByPath({ path: '/en/lifecycle-moved' })).toBeNull()
    expect(
      (await paths.findDocumentByPath({ path: '/en/lifecycle-selected' }))?.document.id,
    ).toBe(draft.id)

    await payload.delete({
      collection: 'path-routes' as never,
      overrideAccess: true,
      where: { path: { equals: '/en/lifecycle-selected' } },
    })
    await paths.rebuildDocumentPaths({ collection: 'pages' })
    expect(
      (await paths.findDocumentByPath({ path: '/en/lifecycle-selected' }))?.document.id,
    ).toBe(draft.id)

    await payload.update({
      collection: 'pages',
      data: { slug: 'lifecycle-draft' },
      draft: true,
      id: draft.id,
      locale: 'en',
    })
    expect(await paths.findDocumentByPath({ path: '/en/lifecycle-draft' })).toBeNull()
    expect(
      (await paths.findDocumentByPath({ path: '/en/lifecycle-selected' }))?.document.id,
    ).toBe(draft.id)

    await payload.update({
      autosave: true,
      collection: 'pages',
      data: { slug: 'lifecycle-autosave' },
      draft: true,
      id: draft.id,
      locale: 'en',
    })
    expect(await paths.findDocumentByPath({ path: '/en/lifecycle-autosave' })).toBeNull()
    expect(
      (await paths.findDocumentByPath({ path: '/en/lifecycle-selected' }))?.document.id,
    ).toBe(draft.id)

    await payload.update({
      collection: 'pages',
      data: {},
      id: draft.id,
      locale: 'en',
      unpublishAllLocales: true,
    })
    expect(await paths.findDocumentByPath({ path: '/en/lifecycle-selected' })).toBeNull()
  })

  it('releases routes when documents are trashed or deleted', async () => {
    const paths = createPathHelpers({ getPayload: () => payload })
    const trashed = await payload.create({
      collection: 'pages',
      data: { _status: 'published', slug: 'lifecycle-trash' },
      locale: 'en',
    })
    await payload.update({
      collection: 'pages',
      data: { deletedAt: new Date().toISOString() },
      id: trashed.id,
      locale: 'en',
      trash: true,
    })
    expect(await paths.findDocumentByPath({ path: '/en/lifecycle-trash' })).toBeNull()

    const deleted = await payload.create({
      collection: 'pages',
      data: { _status: 'published', slug: 'lifecycle-delete' },
      locale: 'en',
    })
    await payload.delete({
      collection: 'pages',
      id: deleted.id,
    })
    expect(await paths.findDocumentByPath({ path: '/en/lifecycle-delete' })).toBeNull()
  })

  it('keeps locale routes independent and converts numeric IDs', async () => {
    const localized = await payload.create({
      collection: 'pages',
      data: { _status: 'published', slug: 'locale-en' },
      locale: 'en',
    })
    await payload.update({
      collection: 'pages',
      data: { _status: 'published', slug: 'locale-uk' },
      fallbackLocale: false,
      id: localized.id,
      locale: 'uk',
    })
    const paths = createPathHelpers({ getPayload: () => payload })
    const english = await paths.findDocumentByPath({ path: '/en/locale-en' })
    const ukrainian = await paths.findDocumentByPath({ path: '/uk/locale-uk' })

    expect(english?.document.id).toBe(localized.id)
    expect(typeof english?.document.id).toBe('number')
    expect(ukrainian?.document.id).toBe(localized.id)
    expect(
      (await payload.find({
        collection: 'path-routes' as never,
        overrideAccess: true,
        where: { path: { equals: '/en/locale-en' } },
      })).docs[0],
    ).toMatchObject({
      collection: 'pages',
      documentID: String(localized.id),
      locale: 'en',
    })

    await payload.update({
      collection: 'pages',
      data: {},
      id: localized.id,
      locale: 'en',
      unpublishAllLocales: true,
    })
    expect(await paths.findDocumentByPath({ path: '/en/locale-en' })).toBeNull()
    expect(await paths.findDocumentByPath({ path: '/uk/locale-uk' })).toBeNull()
  })

  it('enforces global path collisions and supports overrideAccess', async () => {
    const first = await payload.create({
      collection: 'pages',
      data: { _status: 'published', slug: 'global-collision' },
      locale: 'en',
    })
    await expect(
      payload.create({
        collection: 'posts',
        data: { _status: 'published', slug: 'global-collision' },
        locale: 'en',
      }),
    ).rejects.toThrow()
    const paths = createPathHelpers({ getPayload: () => payload })
    expect(
      (await paths.findDocumentByPath({ path: '/en/global-collision' }))?.document.id,
    ).toBe(first.id)

    const privatePage = await payload.create({
      collection: 'private-pages',
      data: { _status: 'published', slug: 'private-route' },
      locale: 'en',
    })
    await expect(
      paths.findDocumentByPath({ path: '/en/private-route' }),
    ).rejects.toThrow()
    expect(
      (await paths.findDocumentByPath({
        overrideAccess: true,
        path: '/en/private-route',
      }))?.document.id,
    ).toBe(privatePage.id)
    expect(first.id).toBeDefined()
  })
})
