import type { Config } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import {
  findSeoRedirect,
  loadDocumentWithoutFallback,
  loadSettingsWithoutFallback,
  renderRobotsTxt,
  renderSchemaJsonLd,
  serializeJsonLd,
  renderSitemapIndexXml,
  renderSitemapXml,
  resolveSeoMetadata,
  resolveSeoPreview,
  resolveSeoMetadataCore,
  resolveEffectiveSeo,
  projectSeoPreview,
  resolveSitemapEligibility,
  seoPlugin,
} from '../src/index.js'
import { SEO_RUNTIME_CONFIG_KEY } from '../src/helpers/config.js'
import { resolveNextMetadata } from '../src/next.js'
import { adminLabel, adminTabLabel, adminText, adminTranslations, resolveAdminLanguage } from '../src/admin/translations.js'
import { previewDocumentFromForm } from '../src/admin/preview-document.js'
import { createSeoPreviewEndpoint } from '../src/endpoints/preview.js'
import { validateAbsoluteHttpUrl, validateCanonicalUrl, validateJson } from '../src/utils/validation.js'
import { SEO_PLUGIN_MARKER, type SeoDocument, type SeoEnabledPluginConfig, type SeoPluginConfig } from '../src/types.js'

const validConfig = (): SeoEnabledPluginConfig => ({
  collections: {
    pages: { schemaType: 'WebPage' },
  },
  siteUrl: 'https://example.com',
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
    expect(outputConfig.collections?.[0]?.endpoints).toContainEqual(expect.objectContaining({ method: 'post', path: '/seo-preview' }))
  })

  it('appends the SEO tab to an existing top-level tabs field without nesting it', async () => {
    const config = payloadConfig()
    config.collections![0]!.fields = [{
      type: 'tabs',
      tabs: [{ label: 'Details', fields: [{ name: 'title', type: 'text' }] }],
    }]

    const output = await seoPlugin(validConfig())(config)
    const tabs = output.collections?.[0]?.fields[0] as any

    expect(output.collections?.[0]?.fields).toHaveLength(1)
    expect(tabs.tabs.map((tab: any) => labelText(tab.label))).toEqual(['Details', 'SEO'])
    expect(tabs.tabs[0].fields).toEqual([{ name: 'title', type: 'text' }])
    expect(tabs.tabs[1].fields[0]).toMatchObject({ name: 'seo', type: 'group' })

    const reapplied = await seoPlugin(validConfig())(output)
    const reappliedTabs = reapplied.collections?.[0]?.fields[0] as any
    expect(reappliedTabs.tabs.map((tab: any) => labelText(tab.label))).toEqual(['Details', 'SEO'])
  })

  it('rejects missing required configuration', () => {
    expect(() => seoPlugin()(payloadConfig())).toThrow('collections must be a non-empty mapping')
    expect(() => seoPlugin({ collections: {} } as SeoPluginConfig)(payloadConfig())).toThrow(
      'collections must be a non-empty mapping',
    )

    const { siteUrl: _siteUrl, ...withoutSiteUrl } = validConfig()
    expect(() => seoPlugin(withoutSiteUrl as SeoEnabledPluginConfig)(payloadConfig())).toThrow(
      'siteUrl must be an absolute HTTP(S) origin',
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

  it('requires API endpoints for an enabled collection preview', () => {
    const config = payloadConfig()
    config.collections![0]!.endpoints = false

    expect(() => seoPlugin(validConfig())(config)).toThrow('must allow endpoints for Admin SEO previews')
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
        titleTemplate: '%s | Example', defaultDescription: 'Default description',
        defaultRobots: { mode: 'noindex-nofollow' },
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
    const manual = await resolveSeoMetadataCore({ collection: 'pages', config, document, locale: 'en', settings: { titleTemplate: 'no placeholder' } })
    expect(manual.canonicalUrl).toBe('https://canonical.example/page')
    expect(manual.openGraph?.image).toBe('https://cdn.example/og.jpg')
    expect(manual.twitter?.image).toBe('https://cdn.example/og.jpg')
    expect(manual.twitter?.card).toBe('summary_large_image')

    const none = await resolveSeoMetadataCore({ collection: 'pages', config, locale: 'en', settings: {}, document: { seo: { canonical: { mode: 'none' } } } })
    expect(none.canonicalUrl).toBeUndefined()
    expect(none.description).toBeUndefined()
    expect(none.robots).toEqual({ index: 'index', follow: 'follow' })
  })

  it('uses a valid raw schema as a full replacement and omits malformed legacy JSON', async () => {
    const config = validConfig()
    const raw = await resolveSeoMetadataCore({
      collection: 'pages', config, locale: 'en', settings: {},
      document: { title: 'Ignored', seo: { schema: { rawJson: '{"@type":"Thing","name":"Raw"}' } } },
    })
    expect(raw.schema).toEqual({ '@type': 'Thing', name: 'Raw' })

    const malformed = await resolveSeoMetadataCore({
      collection: 'pages', config, locale: 'en', settings: {}, document: { seo: { schema: { rawJson: '{bad' } } },
    })
    expect(malformed.schema).toBeUndefined()
  })
})

describe('effective SEO resolution regression coverage', () => {
  const input = (overrides: Record<string, unknown> = {}) => ({
    collection: 'pages', config: validConfig(), locale: 'en',
    settings: { siteName: 'Example', defaultRobots: { mode: 'noindex-follow' } } as SeoDocument,
    document: { id: 'p1', title: 'Page', _status: 'published', ...overrides } as SeoDocument,
  })

  it('inherits global robots until a page explicitly selects an override', async () => {
    expect((await resolveEffectiveSeo(input())).robots).toMatchObject({ mode: 'inherit', index: 'noindex', follow: 'follow' })
    expect((await resolveEffectiveSeo(input({ seo: { robots: { mode: 'index-nofollow' } } }))).robots).toMatchObject({ index: 'index', follow: 'nofollow' })
  })

  it('uses one canonical decision for metadata and sitemap eligibility', async () => {
    const auto = await resolveEffectiveSeo(input({ seo: { canonical: { mode: 'auto' } } }))
    expect(auto.canonical.url).toBe('https://example.com/page')
    expect(await resolveSitemapEligibility({ effective: auto, document: input().document, input: input() })).toBe(false) // inherited noindex

    const manual = await resolveEffectiveSeo(input({ seo: { canonical: { mode: 'manual', url: 'https://example.com/page/' }, robots: { mode: 'index-follow' } } }))
    expect(manual.canonical.url).toBe('https://example.com/page')
    expect(await resolveSitemapEligibility({ effective: manual, document: input().document, input: input({ seo: { canonical: { mode: 'manual', url: 'https://example.com/page/' }, robots: { mode: 'index-follow' } } }) })).toBe(true)

    const external = await resolveEffectiveSeo(input({ seo: { canonical: { mode: 'manual', url: 'https://other.example/page' }, robots: { mode: 'index-follow' } } }))
    expect(external.canonical.external).toBe(true)
    expect(await resolveSitemapEligibility({ effective: external, document: input().document, input: input({ seo: { canonical: { mode: 'manual', url: 'https://other.example/page' }, robots: { mode: 'index-follow' } } }) })).toBe(false)
  })

  it('excludes drafts, missing URLs, and host-defined exclusions from sitemaps', async () => {
    const published = input({ seo: { robots: { mode: 'index-follow' } } })
    const effective = await resolveEffectiveSeo(published)
    expect(await resolveSitemapEligibility({ effective, document: { ...published.document, _status: 'draft' }, input: published })).toBe(false)
    const missing = input({ seo: { canonical: { mode: 'none' }, robots: { mode: 'index-follow' } } })
    expect(await resolveSitemapEligibility({ effective: await resolveEffectiveSeo(missing), document: missing.document, input: missing })).toBe(false)
    const excluded = input({ seo: { robots: { mode: 'index-follow' } } })
    excluded.config.collections.pages.sitemap = { exclude: () => true }
    expect(await resolveSitemapEligibility({ effective: await resolveEffectiveSeo(excluded), document: excluded.document, input: excluded })).toBe(false)
  })

  it('normalizes site URL and rejects unsafe site URL/raw schema values', () => {
    expect(() => seoPlugin({ ...validConfig(), siteUrl: 'https://example.com' })(payloadConfig())).not.toThrow()
    expect(() => seoPlugin({ ...validConfig(), siteUrl: 'https://example.com/base' })(payloadConfig())).toThrow('siteUrl must be an absolute HTTP(S) origin')
    expect(() => seoPlugin({ ...validConfig(), siteUrl: 'https://example.com?x=1' })(payloadConfig())).toThrow('siteUrl must be an absolute HTTP(S) origin')
    expect(() => seoPlugin({ ...validConfig(), siteUrl: 'ftp://example.com' })(payloadConfig())).toThrow('siteUrl must be an absolute HTTP(S) origin')
    expect(validateJson('[]')).not.toBe(true)
    expect(validateJson('null')).not.toBe(true)
    expect(validateJson('"string"')).not.toBe(true)
  })

  it('uses mapped social images, complete social fallbacks, and preview parity', async () => {
    const value = input({ hero: { url: 'https://cdn.example/hero.jpg' }, seo: { robots: { mode: 'index-follow' } } })
    value.config.collections.pages.fields = { title: 'title', image: 'hero' }
    value.config.media.resolveMediaUrl = ({ media }) => media.url as string
    value.settings = { ...value.settings, defaultTwitterCard: 'summary_large_image', defaultTwitterSite: '@example', defaultTwitterCreator: '@author' }
    const effective = await resolveEffectiveSeo(value)
    expect(effective.social.openGraph).toMatchObject({ url: 'https://example.com/page', siteName: 'Example', image: 'https://cdn.example/hero.jpg', locale: 'en' })
    expect(effective.social.twitter).toMatchObject({ card: 'summary_large_image', image: 'https://cdn.example/hero.jpg', site: '@example', creator: '@author' })
    const preview = projectSeoPreview(effective)
    expect(preview.title).toBe(effective.title)
    expect(preview.description).toBe(effective.description)
    expect(preview.canonicalUrl).toBe(effective.canonical.url)
    expect(preview.image).toBe(effective.social.openGraph.image)
  })

  it('preserves supported custom robots directives through framework-neutral metadata', async () => {
    const value = input({ seo: { robots: { mode: 'custom', directives: 'noindex, noarchive, max-snippet:120, unsupported:value' } } })
    const effective = await resolveEffectiveSeo(value)
    expect(effective.robots).toMatchObject({ index: 'noindex', follow: 'follow', custom: ['noindex', 'noarchive', 'max-snippet:120'] })
    expect((await resolveSeoMetadataCore(value)).robots).toEqual({ index: 'noindex', follow: 'follow', custom: ['noindex', 'noarchive', 'max-snippet:120'] })
  })

  it('allows controlled name/image mappings and adds optional breadcrumbs', async () => {
    const value = input({ title: 'Story', hero: { url: 'https://cdn.example/hero.jpg' }, seo: { schema: { values: { name: 'Override', author: 'Ada' } } } })
    value.config.collections.pages = {
      schemaType: 'Article', schema: { name: 'title', image: 'hero' },
      breadcrumbs: () => [{ name: 'Home', url: '/' }, { name: 'Story', url: '/page' }],
    }
    value.config.media.resolveMediaUrl = ({ media }) => media.url as string
    const effective = await resolveEffectiveSeo(value)
    expect(effective.schema).toMatchObject({ '@type': 'Article', name: 'Override', image: 'https://cdn.example/hero.jpg', headline: 'Override', author: { '@type': 'Person', name: 'Ada' } })
    expect(effective.breadcrumbs).toHaveLength(1)
  })

  it('emits organization and WebSite schemas, protects generated reserved keys, and safely serializes JSON-LD', async () => {
    const value = input({ seo: { schema: { values: { name: 'Cannot replace', url: 'https://bad.example', headline: 'Safe' } } } })
    value.settings = { ...value.settings, organizationSchema: { name: 'Example Inc', logo: { url: 'https://cdn.example/logo.png' }, sameAs: [{ url: 'https://social.example/example' }] } }
    value.config.media.resolveMediaUrl = ({ media }) => media.url as string
    const effective = await resolveEffectiveSeo(value)
    expect(effective.schema).toMatchObject({ '@type': 'WebPage', url: 'https://example.com/page', headline: 'Safe' })
    expect(effective.schema?.name).toBe('Cannot replace')
    expect(effective.siteSchemas.some((schema) => schema['@type'] === 'Organization' && schema.logo === 'https://cdn.example/logo.png' && schema.url === 'https://example.com')).toBe(true)
    expect(effective.siteSchemas.some((schema) => schema['@type'] === 'WebSite' && schema.url === 'https://example.com')).toBe(true)
    expect(serializeJsonLd({ name: '</script><script>' })).not.toContain('</script>')
  })

  it('reports resolver failures without exposing document contents', async () => {
    const diagnostics = vi.fn()
    const value = input({ id: 'safe-id', secret: 'must not leak' })
    value.config.resolveUrl = () => { throw new Error('bad') }
    value.config.diagnostics = diagnostics
    await resolveEffectiveSeo(value)
    expect(diagnostics).toHaveBeenCalledWith(expect.objectContaining({ area: 'canonical', documentId: 'safe-id', message: expect.any(String) }))
    expect(JSON.stringify(diagnostics.mock.calls)).not.toContain('must not leak')
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
      findGlobal: vi.fn(async () => ({ robots: { mode: 'generated', groups: [{ userAgent: '*', disallow: [{ path: '/private&area' }] }] } })),
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
    expect(await resolveSeoPreview({ payload, collection: 'pages', id: 'page-1', locale: 'en' })).toMatchObject({ title: result.title, canonicalUrl: result.canonicalUrl, robots: result.robots })
    expect(await resolveNextMetadata({ payload, collection: 'pages', id: 'page-1', locale: 'en' })).toMatchObject({ alternates: { languages: { en: 'https://example.com/page' } } })
  })

  it('omits noindex and non-public localized alternates', async () => {
    const payload = runtimePayload()
    payload.findByID = vi.fn(async ({ locale }) => locale === 'es'
      ? { id: 'page-1', title: 'Página', _status: 'draft', seo: { robots: { mode: 'noindex-follow' } } }
      : { id: 'page-1', title: 'Page', _status: 'published' })
    expect((await resolveSeoMetadata({ payload, collection: 'pages', id: 'page-1', locale: 'en' })).alternates).toEqual({ en: 'https://example.com/page' })
  })

  it('renders custom robots as one complete Next robots value', async () => {
    const payload = runtimePayload()
    payload.findGlobal = vi.fn(async () => ({
      defaultRobots: { mode: 'custom', directives: 'noarchive, max-image-preview:large' },
      robots: { mode: 'generated', groups: [] },
    }))
    expect((await resolveNextMetadata({ payload, collection: 'pages', id: 'page-1', locale: 'en' })).robots)
      .toBe('index, follow, noarchive, max-image-preview:large')
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

  it('normalizes same-site sitemap index URLs with the configured trailing-slash policy', async () => {
    const payload = runtimePayload()
    const config = payload.config.custom[SEO_RUNTIME_CONFIG_KEY] as SeoEnabledPluginConfig
    config.url = { trailingSlash: 'always' }
    config.resolveChunkUrl = () => 'https://example.com/sitemap.xml'

    expect(await renderSitemapIndexXml({ payload })).toContain('<loc>https://example.com/sitemap.xml/</loc>')

    config.resolveChunkUrl = () => 'https://cdn.example/sitemap.xml'
    expect(await renderSitemapIndexXml({ payload })).toContain('<loc>https://cdn.example/sitemap.xml</loc>')
  })

  it('rejects CR/LF injection in generated robots and emits valid sitemap directives', async () => {
    const payload = runtimePayload()
    const config = payload.config.custom[SEO_RUNTIME_CONFIG_KEY] as SeoEnabledPluginConfig
    config.robots = { resolveSitemapUrls: () => ['https://example.com/sitemap.xml', 'https://bad.example/\nInjected: yes'] }
    payload.findGlobal = vi.fn(async () => ({
      robots: { mode: 'generated', groups: [{ userAgent: '*\nInjected: yes', allow: [{ path: '/ok' }], disallow: [{ path: '/private\nSitemap: bad' }] }] },
    }))
    expect(await renderRobotsTxt({ payload, locale: 'en' })).toBe('Sitemap: https://example.com/sitemap.xml')
  })

  it('uses narrow projections when the sitemap configuration declares its resolver inputs', async () => {
    const payload = runtimePayload()
    const config = payload.config.custom[SEO_RUNTIME_CONFIG_KEY] as SeoEnabledPluginConfig
    config.collections.pages.sitemap = { fields: ['slug'] }

    await renderSitemapXml({ payload, collection: 'pages', locale: 'en', page: 1 })
    expect(payload.find).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'pages',
      select: expect.objectContaining({ slug: true, updatedAt: true, seo: true, _status: true }),
    }))

    await findSeoRedirect({ payload, sourcePath: '/old' })
    expect(payload.find).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'seo-redirects',
      select: { destination: true, destinationType: true, statusCode: true },
    }))
  })

  it('keeps the healthy sitemap entries when one document callback fails', async () => {
    const payload = runtimePayload()
    const config = payload.config.custom[SEO_RUNTIME_CONFIG_KEY] as SeoEnabledPluginConfig
    config.collections.pages.lastModified = ({ document }) => {
      if (document.id === 'bad') throw new Error('bad document')
      return '2026-01-02T03:04:05.000Z'
    }
    payload.find = vi.fn(async ({ collection }) => collection === 'pages'
      ? { docs: [{ id: 'good', updatedAt: '2026-01-02T03:04:05.000Z' }, { id: 'bad', updatedAt: '2026-01-02T03:04:05.000Z' }], totalDocs: 2 }
      : { docs: [], totalDocs: 0 })
    const sitemap = await renderSitemapXml({ payload, collection: 'pages', locale: 'en', page: 1 })
    expect(sitemap.match(/<url>/g)).toHaveLength(1)
  })
})

describe('Admin preview resolution', () => {
  it('overlays unsaved mapped values without dropping saved document data', () => {
    expect(previewDocumentFromForm(
      { hero: { url: 'https://cdn.example/saved.jpg' }, nested: { keep: true } },
      { heading: { value: 'Unsaved title' }, 'seo.canonical.mode': { value: 'none' }, 'nested.changed': { value: true } },
    )).toEqual({
      heading: 'Unsaved title', hero: { url: 'https://cdn.example/saved.jpg' }, nested: { changed: true, keep: true }, seo: { canonical: { mode: 'none' } },
    })
  })

  it('uses the production resolver for authenticated unsaved Admin previews', async () => {
    const config = validConfig()
    config.collections.pages.fields = { title: 'heading', description: 'summary', image: 'hero' }
    config.media.resolveMediaUrl = ({ media }) => media.url as string
    const payload = {
      config: { admin: { user: 'users' }, collections: [{ slug: 'pages', fields: [{ name: 'seo', type: 'group', fields: [] }] }], custom: { [SEO_RUNTIME_CONFIG_KEY]: config } },
      collections: {},
      findGlobal: vi.fn(async () => ({
        titleTemplate: '%s | Example', defaultDescription: 'Default description', defaultRobots: { mode: 'noindex-follow' },
      })),
      findByID: vi.fn(),
    }
    const document = { heading: 'Unsaved title', hero: { url: 'https://cdn.example/hero.jpg' }, seo: { canonical: { mode: 'none' } } }
    const endpoint = createSeoPreviewEndpoint('pages')
    const response = await endpoint.handler({
      json: async () => ({ document, locale: 'en' }),
      payload,
      user: { collection: 'users', id: 'admin' },
    } as never)

    const preview = await response.json()
    expect(preview).toEqual(await resolveSeoPreview({ payload, collection: 'pages', document, locale: 'en' }))
    expect(preview).toMatchObject({
      title: 'Unsaved title | Example', description: 'Default description', image: 'https://cdn.example/hero.jpg',
      robots: { index: 'noindex', follow: 'follow' },
    })
    expect(preview).not.toHaveProperty('canonicalUrl')
  })

  it('rejects unauthenticated preview requests', async () => {
    const response = await createSeoPreviewEndpoint('pages').handler({ user: null } as never)
    expect(response.status).toBe(401)
  })

  it('rejects authenticated users without Payload Admin access', async () => {
    const response = await createSeoPreviewEndpoint('pages').handler({
      payload: { collections: {}, config: { admin: { user: 'users' } } },
      user: { collection: 'customers', id: 'customer' },
    } as never)
    expect(response.status).toBe(403)
  })

  it('enforces SEO field access before resolving a preview', async () => {
    const config = validConfig()
    const payload = {
      config: { admin: { user: 'users' }, collections: [{ slug: 'pages', fields: [{ name: 'seo', type: 'group', access: { read: () => false }, fields: [] }] }], custom: { [SEO_RUNTIME_CONFIG_KEY]: config } },
      collections: {}, findGlobal: vi.fn(), findByID: vi.fn(),
    }
    const response = await createSeoPreviewEndpoint('pages').handler({
      json: async () => ({ document: { title: 'Hidden' }, locale: 'en' }), payload, user: { collection: 'users', id: 'editor' },
    } as never)
    expect(response.status).toBe(403)
  })
})

describe('canonical write-time contract', () => {
  it('matches runtime canonical restrictions and normalization', async () => {
    expect(validateCanonicalUrl('https://example.com/page?source=bad')).not.toBe(true)
    expect(validateCanonicalUrl('https://example.com/page#fragment')).not.toBe(true)
    expect(validateCanonicalUrl('https://example.com/page/')).toBe(true)
    const result = await resolveEffectiveSeo({ collection: 'pages', config: validConfig(), locale: 'en', settings: {}, document: { seo: { canonical: { mode: 'manual', url: 'https://example.com/page/' } } } })
    expect(result.canonical.url).toBe('https://example.com/page')
  })
})
