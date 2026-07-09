import type { Config } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { seoPlugin } from '../src/index.js'
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

  it('validates the contract and safely selects configured collections without mutating config', () => {
    const inputConfig = payloadConfig()
    const outputConfig = seoPlugin(validConfig())(inputConfig)

    expect(outputConfig).toBe(inputConfig)
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

  it('accepts an existing field with the generated marker for idempotent reapplication', () => {
    const config = payloadConfig()
    config.collections![0]!.fields = [
      {
        name: 'seo',
        type: 'group',
        fields: [],
        admin: { custom: { seo: { marker: SEO_PLUGIN_MARKER } } },
      },
    ]

    expect(seoPlugin(validConfig())(config)).toBe(config)
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
