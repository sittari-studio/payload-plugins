import type { Config } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import {
  findSeoRedirect,
  loadDocumentWithoutFallback,
  loadSettingsWithoutFallback,
  renderRobotsTxt,
  renderSchemaJsonLd,
  renderSitemapIndexXml,
  renderSitemapXml,
  resolveSeoMetadata,
  resolveSeoMetadataCore,
  seoPlugin,
} from '../src/index.js'
import { SEO_RUNTIME_CONFIG_KEY } from '../src/helpers/config.js'
import { resolveNextMetadata } from '../src/next.js'
import { SEO_PLUGIN_MARKER, type SeoEnabledPluginConfig, type SeoPluginConfig } from '../src/types.js'

const validConfig = (): SeoEnabledPluginConfig => ({
  collections: {
    pages: { schemaType: 'WebPage' },
  },
  media: {
    collection: 'media',
    resolveMediaUrl: vi.fn(() => 'https://example.com/image.jpg'),
  },
  resolveChunkUrl: vi.fn(() => 'https://example.com/sitemap.xml'),
  resolveUrl: vi.fn(() => '/page'),
})

const payloadConfig = (): Config => ({
  collections: [
    { slug: 'pages', fields: [] },
    { slug: 'media', fields: [] },
  ],
}) as unknown as Config

describe('seoPlugin', () => {
  it('returns the exact incoming config and skips validation when disabled', () => {
    const inputConfig = payloadConfig()

    expect(seoPlugin({ enabled: false })(inputConfig)).toBe(inputConfig)
  })

  it('validates the contract and adds the marked SEO fields, Global, and redirects collection', async () => {
    const inputConfig = payloadConfig()
    const outputConfig = await seoPlugin(validConfig())(inputConfig)

    expect(outputConfig).not.toBe(inputConfig)
    expect(outputConfig.collections).toHaveLength(3)
    expect(outputConfig.collections?.[0]?.fields).toContainEqual(expect.objectContaining({ name: 'seo', type: 'group' }))
    const seoField = outputConfig.collections?.[0]?.fields.find((field) => 'name' in field && field.name === 'seo')
    expect(seoField).toMatchObject({ admin: { components: { Field: '@krameri/payload-seo/client#SeoPreviews' } } })
    const schema = (seoField as any).fields.find((field: any) => field.name === 'schema')
    expect(schema.fields.find((field: any) => field.name === 'rawJson')).toMatchObject({ admin: { components: { Field: '@krameri/payload-seo/client#ResetRawJson' } } })
    expect(schema.fields.find((field: any) => field.name === 'values').fields.map((field: any) => field.name)).toContain('headline')
    expect(outputConfig.globals).toContainEqual(expect.objectContaining({ slug: 'seo-settings' }))
    expect(outputConfig.collections?.[2]).toMatchObject({ slug: 'seo-redirects', timestamps: true })
  })

  it('rejects missing required configuration', () => {
    expect(() => seoPlugin()(payloadConfig())).toThrow('collections must be a non-empty mapping')
    expect(() => seoPlugin({ collections: {} } as SeoPluginConfig)(payloadConfig())).toThrow(
      'collections must be a non-empty mapping',
    )
  })

  it('rejects a configured collection that is absent from Payload config', () => {
    const config = validConfig()
    config.collections.posts = { schemaType: 'Article' }

    expect(() => seoPlugin(config)(payloadConfig())).toThrow('configured collection "posts" does not exist')
  })

  it('rejects a user-owned generated field name collision', () => {
    const config = payloadConfig()
    config.collections![0]!.fields = [{ name: 'seo', type: 'text' }]

    expect(() => seoPlugin(validConfig())(config)).toThrow('already has a field named "seo"')
  })

  it('accepts an existing field with the generated marker for idempotent reapplication', async () => {
    const config = payloadConfig()
    config.collections![0]!.fields = [
      {
        name: 'seo',
        type: 'group',
        fields: [],
        admin: { custom: { seo: { marker: SEO_PLUGIN_MARKER } } },
      },
    ]

    const output = await seoPlugin(validConfig())(config)
    expect(output.collections?.[0]?.fields).toHaveLength(1)
    expect(output.collections?.filter((collection) => collection.slug === 'seo-redirects')).toHaveLength(1)
    expect(output.globals?.filter((global) => global.slug === 'seo-settings')).toHaveLength(1)
  })

  it('rejects user-owned settings and redirects generated-name collisions', () => {
    const globalCollision = payloadConfig()
    globalCollision.globals = [{ slug: 'seo-settings', fields: [] }]
    expect(() => seoPlugin(validConfig())(globalCollision)).toThrow('Global named "seo-settings" already exists')

    const collectionCollision = payloadConfig()
    collectionCollision.collections!.push({ slug: 'seo-redirects', fields: [] })
    expect(() => seoPlugin(validConfig())(collectionCollision)).toThrow(
      'collection named "seo-redirects" already exists',
    )
  })
})

describe('locale-safe resolver core', () => {
  it('passes the exact locale and disables fallback for all Payload reads', async () => {
    const payload = {
      findByID: vi.fn(async () => ({})),
      findGlobal: vi.fn(async () => ({})),
    }

    await loadDocumentWithoutFallback({ payload, collection: 'pages', id: 'page-1', locale: 'es' })
    await loadSettingsWithoutFallback({ payload, slug: 'seo-settings', locale: 'es' })

    expect(payload.findByID).toHaveBeenCalledWith({ collection: 'pages', id: 'page-1', locale: 'es', fallbackLocale: false, draft: false })
    expect(payload.findGlobal).toHaveBeenCalledWith({ slug: 'seo-settings', locale: 'es', fallbackLocale: false, draft: false })
  })

  it('uses same-locale document and settings fallbacks without creating empty output', async () => {
    const config = validConfig()
    config.collections.pages.fields = { title: 'title', description: 'excerpt' }
    const result = await resolveSeoMetadataCore({
      collection: 'pages', config, locale: 'es', settings: {
        siteUrl: 'https://example.com', titleTemplate: '%s | Example', defaultDescription: 'Default description',
        defaultRobots: { index: 'noindex', follow: 'nofollow' },
      },
      document: { title: 'Página', excerpt: '', seo: { openGraph: {}, twitter: {} } },
      names: undefined,
    })

    expect(result).toMatchObject({
      title: 'Página | Example', description: 'Default description', canonicalUrl: 'https://example.com/page',
      robots: { index: 'noindex', follow: 'nofollow' },
      openGraph: { title: 'Página | Example', description: 'Default description' },
      twitter: { title: 'Página | Example', description: 'Default description' },
    })
    expect(result.schema).toMatchObject({ '@type': 'WebPage', url: 'https://example.com/page' })
  })

  it('omits invalid values, honors manual/none canonical modes, and applies social chains', async () => {
    const config = validConfig()
    config.media.resolveMediaUrl = vi.fn(({ media }) => media.url as string | null)
    config.resolveUrl = vi.fn(() => 'https://not-a-relative-path.example')
    const document = {
      seo: {
        title: 'SEO title', canonical: { mode: 'manual', url: 'https://canonical.example/page' },
        openGraph: { image: { url: 'https://cdn.example/og.jpg' } },
        twitter: { image: { url: 'not a url' }, card: 'summary_large_image' },
      },
    }
    const manual = await resolveSeoMetadataCore({ collection: 'pages', config, document, locale: 'en', settings: { siteUrl: 'invalid', titleTemplate: 'no placeholder' } })
    expect(manual.canonicalUrl).toBe('https://canonical.example/page')
    expect(manual.openGraph?.image).toBe('https://cdn.example/og.jpg')
    expect(manual.twitter?.image).toBe('https://cdn.example/og.jpg')
    expect(manual.twitter?.card).toBe('summary_large_image')

    const none = await resolveSeoMetadataCore({ collection: 'pages', config, locale: 'en', settings: {}, document: { seo: { canonical: { mode: 'none' } } } })
    expect(none.canonicalUrl).toBeUndefined()
    expect(none.description).toBeUndefined()
    expect(none.robots).toBeUndefined()
  })

  it('uses a valid raw schema as a full replacement and omits malformed legacy JSON', async () => {
    const config = validConfig()
    const raw = await resolveSeoMetadataCore({
      collection: 'pages', config, locale: 'en', settings: { siteUrl: 'https://example.com' },
      document: { title: 'Ignored', seo: { schema: { rawJson: '{"@type":"Thing","name":"Raw"}' } } },
    })
    expect(raw.schema).toEqual({ '@type': 'Thing', name: 'Raw' })

    const malformed = await resolveSeoMetadataCore({
      collection: 'pages', config, locale: 'en', settings: {}, document: { seo: { schema: { rawJson: '{bad' } } },
    })
    expect(malformed.schema).toBeUndefined()
  })
})

describe('frontend helpers', () => {
  const runtimePayload = () => {
    const config = validConfig()
    config.collections.pages.fields = { title: 'title' }
    return {
      config: {
        custom: { [SEO_RUNTIME_CONFIG_KEY]: config },
        localization: { locales: ['en', 'es'] },
      },
      findByID: vi.fn(async ({ locale }) => ({ id: 'page-1', title: locale === 'es' ? 'Página' : 'Page' })),
      findGlobal: vi.fn(async () => ({ siteUrl: 'https://example.com', robots: { mode: 'generated', groups: [{ userAgent: '*', disallow: [{ path: '/private&area' }] }] } })),
      find: vi.fn(async ({ collection }) => collection === 'seo-redirects'
        ? { docs: [{ destinationType: 'internal', destination: '/new', statusCode: '301' }] }
        : { docs: [{ id: 'page-1', updatedAt: '2026-01-02T03:04:05.000Z' }], totalDocs: 1 }),
    }
  }

  it('projects normalized metadata, schema, and locale alternates without a Next runtime import', async () => {
    const payload = runtimePayload()
    const result = await resolveSeoMetadata({ payload, collection: 'pages', id: 'page-1', locale: 'en' })
    expect(result).toMatchObject({ title: 'Page', alternates: { en: 'https://example.com/page', es: 'https://example.com/page' } })
    expect(await renderSchemaJsonLd({ payload, collection: 'pages', id: 'page-1', locale: 'en' })).toMatchObject({ '@type': 'WebPage' })
    expect(await resolveNextMetadata({ payload, collection: 'pages', id: 'page-1', locale: 'en' })).toMatchObject({ alternates: { languages: { en: 'https://example.com/page' } } })
  })

  it('renders redirects, robots, and escaped sitemap XML from plugin configuration', async () => {
    const payload = runtimePayload()
    expect(await findSeoRedirect({ payload, sourcePath: ' /old ' })).toEqual({ destination: '/new', statusCode: 301 })
    expect(await renderRobotsTxt({ payload, locale: 'en' })).toBe('User-agent: *\nDisallow: /private&area')
    const sitemap = await renderSitemapXml({ payload, collection: 'pages', locale: 'en', page: 1 })
    expect(sitemap).toContain('<loc>https://example.com/page</loc>')
    expect(sitemap).toContain('<lastmod>2026-01-02T03:04:05.000Z</lastmod>')
    const index = await renderSitemapIndexXml({ payload })
    expect(index).toContain('<loc>https://example.com/sitemap.xml</loc>')
  })
})
