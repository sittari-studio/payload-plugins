import type { Config, Field } from 'payload'
import { describe, expect, it } from 'vitest'

import {
  createFlexiblePageType,
  createStandardContentPageType,
  pagesPlugin,
} from '../src/index.js'

const getPagesCollection = (config: Config) =>
  config.collections?.find((collection) => collection.slug === 'pages')

const getNamedField = (fields: Field[], name: string) =>
  fields.find((field) => 'name' in field && field.name === name)

describe('pagesPlugin', () => {
  it('adds the pages collection and preserves existing collections', () => {
    const existingCollection = {
      slug: 'posts',
      fields: [],
    }
    const inputConfig = {
      collections: [existingCollection],
    } as unknown as Config

    const outputConfig = pagesPlugin({
      pageTypes: {
        standardContent: createStandardContentPageType(),
      },
    })(inputConfig)

    expect(outputConfig.collections).toHaveLength(2)
    expect(outputConfig.collections?.[0]).toBe(existingCollection)
    expect(getPagesCollection(outputConfig)).toMatchObject({
      versions: {
        drafts: {
          autosave: {
            interval: 375,
          },
        },
      },
    })
  })

  it('returns the incoming config when disabled', () => {
    const inputConfig = {
      collections: [],
    } as unknown as Config

    const outputConfig = pagesPlugin({ enabled: false })(inputConfig)

    expect(outputConfig).toBe(inputConfig)
  })

  it('creates page types from the exported factories', () => {
    const outputConfig = pagesPlugin({
      pageTypes: {
        standardContent: createStandardContentPageType(),
        flexible: createFlexiblePageType({
          blockSlugs: ['hero', 'content'],
        }),
      },
    })({ collections: [] } as unknown as Config)
    const pages = getPagesCollection(outputConfig)

    const pageType = getNamedField(pages?.fields ?? [], 'pageType')
    const flexible = getNamedField(pages?.fields ?? [], 'flexible')
    const standardContent = getNamedField(pages?.fields ?? [], 'standardContent')

    expect(pageType).toMatchObject({
      type: 'select',
      options: [
        {
          label: {
            en: 'Standard Content',
            ru: 'Стандартный контент',
            uk: 'Стандартний контент',
          },
          value: 'standardContent',
        },
        {
          label: { en: 'Flexible', ru: 'Конструктор', uk: 'Конструктор' },
          value: 'flexible',
        },
      ],
    })
    expect(flexible).toMatchObject({
      type: 'group',
      fields: [
        {
          name: 'blocks',
          type: 'blocks',
          blockReferences: ['hero', 'content'],
          blocks: [],
        },
      ],
    })
    expect(standardContent).toMatchObject({
      type: 'group',
      fields: [{ name: 'content', type: 'richText' }],
    })
  })

  it('accepts custom page types alongside factory-created page types', () => {
    const outputConfig = pagesPlugin({
      pageTypes: {
        standardContent: createStandardContentPageType(),
        blogIndex: {
          label: 'Blog Index',
          fields: [{ name: 'heading', type: 'text' }],
        },
      },
    })({ collections: [] } as unknown as Config)
    const pages = getPagesCollection(outputConfig)

    expect(getNamedField(pages?.fields ?? [], 'pageType')).toMatchObject({
      options: expect.arrayContaining([{ label: 'Blog Index', value: 'blogIndex' }]),
    })

    expect(getNamedField(pages?.fields ?? [], 'blogIndex')).toMatchObject({
      type: 'group',
      label: false,
      fields: [{ name: 'heading', type: 'text' }],
    })
  })

  it('allows factory defaults to be replaced without merging', () => {
    const standardContent = createStandardContentPageType({
      label: 'Article',
      fields: [{ name: 'body', type: 'textarea' }],
    })
    const flexible = createFlexiblePageType({
      label: 'Page builder',
      fields: [{ name: 'layout', type: 'json' }],
      blockSlugs: ['unused-when-fields-are-replaced'],
    })

    expect(standardContent).toEqual({
      label: 'Article',
      fields: [{ name: 'body', type: 'textarea' }],
    })
    expect(flexible).toEqual({
      label: 'Page builder',
      fields: [{ name: 'layout', type: 'json' }],
    })
  })

  it('allows the final collection config to be overridden', () => {
    const outputConfig = pagesPlugin({
      pageTypes: {
        standardContent: createStandardContentPageType(),
      },
      overrides: (defaultCollection) => ({
        ...defaultCollection,
        fields: [
          ...defaultCollection.fields,
          { name: 'internalName', type: 'text' },
        ],
      }),
    })({ collections: [] } as unknown as Config)
    const pages = getPagesCollection(outputConfig)

    expect(getNamedField(pages?.fields ?? [], 'slug')).toBeUndefined()
    expect(getNamedField(pages?.fields ?? [], 'internalName')).toMatchObject({
      type: 'text',
    })
  })

  it('requires at least one page type', () => {
    expect(() =>
      pagesPlugin({ pageTypes: {} })({ collections: [] } as unknown as Config),
    ).toThrow('pagesPlugin requires at least one page type')
  })
})
