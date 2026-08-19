import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildConfig, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createPathHelpers, permalinkPlugin } from '../src/index.js'

const databaseFile = join(tmpdir(), `payload-permalink-${randomUUID()}.sqlite`)
let payload: Payload

beforeAll(async () => {
  const config = await buildConfig({
    secret: 'payload-permalink-integration-secret',
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
        admin: { useAsTitle: 'title' },
        trash: true,
        versions: {
          drafts: {
            autosave: true,
            localizeStatus: true,
          },
        },
        fields: [
          {
            name: 'title',
            type: 'text',
            localized: true,
            required: true,
          },
        ],
      },
      {
        slug: 'posts',
        access: { read: () => true },
        admin: { useAsTitle: 'title' },
        fields: [{ name: 'title', type: 'text', required: true }],
      },
    ],
    plugins: [
      permalinkPlugin({
        collections: {
          pages: { prefix: '' },
          posts: { prefix: 'blog/page' },
        },
        localePrefix: 'as-needed',
        siteUrl: 'https://example.com',
      }),
    ],
  })

  payload = await getPayload({
    config,
    key: `permalink-integration-${databaseFile}`,
  })
})

afterAll(async () => {
  await payload.db.destroy?.()
  await rm(databaseFile, { force: true })
})

describe('WordPress-style permalink integration', () => {
  it('generates slugs and canonical paths from collection prefixes', async () => {
    const page = await payload.create({
      collection: 'pages',
      data: { _status: 'published', title: 'About Us' },
      locale: 'en',
    }) as unknown as { path: string; slug: string }
    const post = await payload.create({
      collection: 'posts',
      data: { title: 'Launch' },
      locale: 'en',
    }) as unknown as { path: string; slug: string }

    expect(page.slug).toBe('about-us')
    expect(page.path).toBe('/about-us')
    expect(post.slug).toBe('launch')
    expect(post.path).toBe('/blog/page/launch')
  })

  it('stores locale prefixes in the canonical path', async () => {
    const page = await payload.create({
      collection: 'pages',
      data: { _status: 'published', title: 'Contact' },
      locale: 'en',
    }) as unknown as { id: number | string }

    const ukrainian = await payload.update({
      collection: 'pages',
      data: { _status: 'published', title: 'Контакти' },
      fallbackLocale: false,
      id: page.id,
      locale: 'uk',
    }) as unknown as { path: string; slug: string }

    expect(ukrainian.slug).toBe('kontakty')
    expect(ukrainian.path).toBe('/uk/kontakty')
  })

  it('resolves documents through the global route registry', async () => {
    const page = await payload.create({
      collection: 'pages',
      data: { _status: 'published', title: 'Registry' },
      locale: 'en',
    })
    const helpers = createPathHelpers({ getPayload: () => payload })

    const found = await helpers.findDocumentByPath({ path: '/registry' })
    expect(found?.collection).toBe('pages')
    expect(found?.document.id).toBe(page.id)
    expect(found?.route).toEqual({
      canonicalPath: '/registry',
      isCanonical: true,
      page: 1,
    })
  })

  it('suffixes conflicting published permalinks with the document id', async () => {
    const owner = await payload.create({
      collection: 'pages',
      data: { _status: 'published', title: 'Conflict Owner' },
      locale: 'en',
    })
    const duplicate = await payload.create({
      collection: 'pages',
      data: {
        _status: 'published',
        slug: 'conflict-owner',
        title: 'Conflict Copy',
      },
      locale: 'en',
    }) as unknown as { id: number | string; path: string; slug: string }
    const helpers = createPathHelpers({ getPayload: () => payload })

    expect(duplicate.slug).toBe(`conflict-owner-${duplicate.id}`)
    expect(duplicate.path).toBe(`/conflict-owner-${duplicate.id}`)
    expect(
      (await helpers.findDocumentByPath({ path: '/conflict-owner' }))?.document.id,
    ).toBe(owner.id)
    expect(
      (await helpers.findDocumentByPath({ path: duplicate.path }))?.document.id,
    ).toBe(duplicate.id)
  })

  it('does not suffix draft permalinks that overlap published routes', async () => {
    const owner = await payload.create({
      collection: 'pages',
      data: { _status: 'published', title: 'Draft Conflict' },
      locale: 'en',
    })
    const draft = await payload.create({
      collection: 'pages',
      data: {
        _status: 'draft',
        slug: 'draft-conflict',
        title: 'Draft Conflict Copy',
      },
      draft: true,
      locale: 'en',
    }) as unknown as { id: number | string; path: string; slug: string }
    const helpers = createPathHelpers({ getPayload: () => payload })

    expect(draft.slug).toBe('draft-conflict')
    expect(draft.path).toBe('/draft-conflict')
    expect(
      (await helpers.findDocumentByPath({ path: '/draft-conflict' }))?.document.id,
    ).toBe(owner.id)
    expect(draft.id).not.toBe(owner.id)
  })

  it('does not move a published route when only its draft slug changes', async () => {
    const page = await payload.create({
      collection: 'pages',
      data: { _status: 'published', title: 'Published Route' },
      locale: 'en',
    }) as unknown as { id: number | string }
    const helpers = createPathHelpers({ getPayload: () => payload })

    const draft = await payload.update({
      collection: 'pages',
      data: { slug: 'future-route' },
      draft: true,
      id: page.id,
      locale: 'en',
    }) as unknown as { path: string }

    expect(draft.path).toBe('/future-route')
    expect(
      (await helpers.findDocumentByPath({ path: '/published-route' }))?.document.id,
    ).toBe(page.id)
    expect(await helpers.findDocumentByPath({ path: '/future-route' })).toBeNull()
  })

  it('moves the route when the changed draft is published', async () => {
    const page = await payload.create({
      collection: 'pages',
      data: { _status: 'published', title: 'Before Publish' },
      locale: 'en',
    }) as unknown as { id: number | string }
    const helpers = createPathHelpers({ getPayload: () => payload })

    await payload.update({
      collection: 'pages',
      data: { slug: 'after-publish' },
      draft: true,
      id: page.id,
      locale: 'en',
    })
    await payload.update({
      collection: 'pages',
      data: { _status: 'published', slug: 'after-publish' },
      draft: true,
      id: page.id,
      locale: 'en',
    })

    expect(await helpers.findDocumentByPath({ path: '/before-publish' })).toBeNull()
    expect(
      (await helpers.findDocumentByPath({ path: '/after-publish' }))?.document.id,
    ).toBe(page.id)
  })

  it('restores trashed documents as drafts without reclaiming occupied routes', async () => {
    const original = await payload.create({
      collection: 'pages',
      data: { _status: 'published', title: 'Restore Collision' },
      locale: 'en',
    }) as unknown as { id: number | string }
    const helpers = createPathHelpers({ getPayload: () => payload })

    await payload.delete({ collection: 'pages', id: original.id })
    expect(await helpers.findDocumentByPath({ path: '/restore-collision' })).toBeNull()

    const replacement = await payload.create({
      collection: 'pages',
      data: {
        _status: 'published',
        slug: 'restore-collision',
        title: 'Replacement',
      },
      locale: 'en',
    })

    const restored = await payload.update({
      collection: 'pages',
      data: { _status: 'published', deletedAt: null },
      id: original.id,
      locale: 'en',
      trash: true,
    }) as unknown as { _status: string; deletedAt: null }

    expect(restored.deletedAt).toBeNull()
    expect(restored._status).toBe('draft')
    expect(
      (await helpers.findDocumentByPath({ path: '/restore-collision' }))?.document.id,
    ).toBe(replacement.id)
  })

  it('releases routes when documents are deleted', async () => {
    const page = await payload.create({
      collection: 'pages',
      data: { _status: 'published', title: 'Delete Me' },
      locale: 'en',
    }) as unknown as { id: number | string }
    const helpers = createPathHelpers({ getPayload: () => payload })

    await payload.delete({ collection: 'pages', id: page.id })
    expect(await helpers.findDocumentByPath({ path: '/delete-me' })).toBeNull()
  })

  it('keeps exact-document precedence over pagination fallback', async () => {
    const base = await payload.create({
      collection: 'pages',
      data: { _status: 'published', slug: 'blog', title: 'Blog' },
      locale: 'en',
    })
    const exact = await payload.create({
      collection: 'posts',
      data: { slug: '2', title: 'Exact Page Two' },
      locale: 'en',
    })
    const helpers = createPathHelpers({ getPayload: () => payload })

    const pageTwo = await helpers.findDocumentByPath({ path: '/blog/page/2' })
    expect(pageTwo?.collection).toBe('posts')
    expect(pageTwo?.document.id).toBe(exact.id)
    expect(pageTwo?.route?.page).toBe(1)

    const pageThree = await helpers.findDocumentByPath({ path: '/blog/page/3' })
    expect(pageThree?.collection).toBe('pages')
    expect(pageThree?.document.id).toBe(base.id)
    expect(pageThree?.route).toEqual({
      canonicalPath: '/blog/page/3',
      isCanonical: true,
      page: 3,
    })
  })
})
