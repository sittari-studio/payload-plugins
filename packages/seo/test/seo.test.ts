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
import { adminLabel, adminTabLabel, adminText, adminTranslations, resolveAdminLanguage } from '../src/admin/translations.js'
import { validateAbsoluteHttpUrl, validateJson } from '../src/utils/validation.js'
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

const labelText = (label: unknown, language = 'en'): string => {
  if (typeof label === 'function') {
    return label({ i18n: { language }, t: vi.fn() })
  }
  if (label && typeof label === 'object') {
    const labels = label as Record<string, string>
    return labels[language] ?? labels[resolveAdminLanguage(language)] ?? labels.en
  }
  return label as string
}

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
    const tabs = outputConfig.collections?.[0]?.fields[0] as any
    expect(tabs.type).toBe('tabs')
    expect(tabs.tabs.map((tab: any) => labelText(tab.label))).toEqual(['Content', 'SEO'])
    const seoField = tabs.tabs[1].fields.find((field: any) => field.name === 'seo')
    expect(seoField).toMatchObject({ type: 'group' })
    const seoTabs = seoField.fields.find((field: any) => field.type === 'tabs')
    expect(seoTabs.tabs.map((tab: any) => labelText(tab.label))).toEqual(['General', 'Canonical', 'Robots', 'Open Graph', 'X / Twitter', 'Schema', 'Previews'])
    const schema = seoTabs.tabs.find((tab: any) => labelText(tab.label) === 'Schema').fields[0]
    expect(schema.fields.find((field: any) => field.name === 'rawJson')).toMatchObject({
      admin: {
        components: { Field: '@krameri/payload-seo/client#ResetRawJson' },
        custom: { seo: { collectionSchema: {}, defaultType: 'WebPage' } },
      },
    })
    expect(schema.fields.find((field: any) => field.name === 'values')).toMatchObject({
      admin: {
        components: { Field: '@krameri/payload-seo/client#SchemaValueOverrides' },
        custom: { seo: { schemaMappings: {} } },
      },
    })
    expect(schema.fields.find((field: any) => field.name === 'values').fields.map((field: any) => field.name)).toContain('headline')
    const settings = outputConfig.globals?.find((global) => global.slug === 'seo-settings') as any
    expect(settings.fields[0].tabs.map((tab: any) => labelText(tab.label))).toEqual(['Site defaults', 'Social defaults', 'Default robots', 'Organization schema', 'robots.txt'])
    expect(outputConfig.collections?.[2]).toMatchObject({ slug: 'seo-redirects', timestamps: true })
  })

  it('rejects missing required configuration', () => {
    expect(() => seoPlugin()(payloadConfig())).toThrow('collections must be a non-empty mapping')
    expect(() => seoPlugin({ collections: {} } as SeoPluginConfig)(payloadConfig())).toThrow(
      'collections must be a non-empty mapping',
    )
  })

  it('validates optional sitemap field projections', () => {
    const config = validConfig()
    config.collections.pages.sitemap = { fields: ['slug', 'updatedAt'] }
    expect(() => seoPlugin(config)(payloadConfig())).not.toThrow()

    config.collections.pages.sitemap = { fields: ['slug', ''] }
    expect(() => seoPlugin(config)(payloadConfig())).toThrow('sitemap.fields must be an array of non-empty field paths')
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
    const tabs = output.collections?.[0]?.fields[0] as any
    expect(tabs.tabs[0].fields).toHaveLength(0)
    expect(tabs.tabs[1].fields).toHaveLength(1)
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

describe('Admin translations', () => {
  it('keeps all English, Russian, and Ukrainian catalogs complete', () => {
    const keys = Object.keys(adminTranslations.en).sort()
    for (const language of Object.values(adminTranslations)) {
      expect(Object.keys(language).sort()).toEqual(keys)
      expect(Object.values(language).every((value) => value.trim().length > 0)).toBe(true)
    }
  })

  it('normalizes supported regional codes and falls back to complete English copy', () => {
    expect(resolveAdminLanguage('en-GB')).toBe('en')
    expect(resolveAdminLanguage('ru-RU')).toBe('ru')
    expect(resolveAdminLanguage('uk-UA')).toBe('uk')
    expect(resolveAdminLanguage('de-DE')).toBe('en')
    expect(adminText('previewTitle', 'ru-RU')).toBe('Заголовок страницы')
    expect(adminText('previewTitle', 'uk-UA')).toBe('Заголовок сторінки')
    expect(adminText('previewTitle', 'de-DE')).toBe('Page title')
  })

  it('uses the active Admin language for generated labels without changing stored values', async () => {
    const output = await seoPlugin(validConfig())(payloadConfig())
    const tabs = output.collections?.[0]?.fields[0] as any
    const seoField = tabs.tabs[1].fields.find((field: any) => field.name === 'seo')
    const seoTabs = seoField.fields.find((field: any) => field.type === 'tabs')
    const canonicalTab = seoTabs.tabs.find((tab: any) => labelText(tab.label) === 'Canonical')
    const canonicalMode = canonicalTab.fields[0].fields.find((field: any) => field.name === 'mode')

    expect(labelText(tabs.tabs[0].label, 'ru-RU')).toBe('Содержимое')
    expect(labelText(tabs.tabs[0].label, 'uk-UA')).toBe('Вміст')
    expect(labelText(tabs.tabs[0].label, 'de-DE')).toBe('Content')
    expect(adminTabLabel('general')).toMatchObject({ ru: 'Основное', uk: 'Загальне', 'uk-UA': 'Загальне' })
    expect((adminLabel('contentTab') as any)({})).toBe('Content')
    expect(canonicalMode.options.map((option: any) => ({ label: labelText(option.label, 'uk'), value: option.value }))).toEqual([
      { label: 'Автоматично', value: 'auto' },
      { label: 'Вручну', value: 'manual' },
      { label: 'Немає', value: 'none' },
    ])
    expect(labelText(adminLabel('clearRawJson'), 'ru')).toBe('Очистить переопределение Raw JSON')
  })

  it('localizes plugin-owned validation messages from the active Admin language', () => {
    const ukRequest = { req: { i18n: { language: 'uk-UA' } } }
    const ruRequest = { req: { i18n: { language: 'ru-RU' } } }

    expect(validateAbsoluteHttpUrl('not a URL', ukRequest)).toBe('Введіть абсолютний URL HTTP або HTTPS.')
    expect(validateJson('{bad', ruRequest)).toBe('Введите корректный JSON.')
    expect(validateJson('{bad', { req: { i18n: { language: 'de-DE' } } })).toBe('Enter valid JSON.')
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

  it('uses narrow projections when the sitemap configuration declares its resolver inputs', async () => {
    const payload = runtimePayload()
    const config = payload.config.custom[SEO_RUNTIME_CONFIG_KEY] as SeoEnabledPluginConfig
    config.collections.pages.sitemap = { fields: ['slug'] }

    await renderSitemapXml({ payload, collection: 'pages', locale: 'en', page: 1 })
    expect(payload.find).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'pages',
      select: { slug: true, updatedAt: true },
    }))

    await findSeoRedirect({ payload, sourcePath: '/old' })
    expect(payload.find).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'seo-redirects',
      select: { destination: true, destinationType: true, statusCode: true },
    }))
  })
})
