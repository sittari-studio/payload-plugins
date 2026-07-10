import type { Config, Field } from 'payload'
import { describe, expect, it } from 'vitest'

import { pagesPlugin } from '../src/index.js'

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

    const outputConfig = pagesPlugin()(inputConfig)

    expect(outputConfig.collections).toHaveLength(2)
    expect(outputConfig.collections?.[0]).toBe(existingCollection)
    expect(getPagesCollection(outputConfig)).toBeDefined()
  })

  it('returns the incoming config when disabled', () => {
    const inputConfig = {
      collections: [],
    } as unknown as Config

    const outputConfig = pagesPlugin({ enabled: false })(inputConfig)

    expect(outputConfig).toBe(inputConfig)
  })

  it('creates the default page types and applies block references', () => {
    const outputConfig = pagesPlugin({ blockSlugs: ['hero', 'content'] })({
      collections: [],
    } as unknown as Config)
    const pages = getPagesCollection(outputConfig)

    const pageType = getNamedField(pages?.fields ?? [], 'pageType')
    const flexible = getNamedField(pages?.fields ?? [], 'flexible')
    const standardContent = getNamedField(pages?.fields ?? [], 'standardContent')

    expect(pageType).toMatchObject({
      type: 'select',
      options: [
        { label: 'Standard Content', value: 'standardContent' },
        { label: 'Flexible', value: 'flexible' },
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

  it('allows page types to be extended', () => {
    const outputConfig = pagesPlugin({
      pageTypes: ({ defaultPageTypes }) => ({
        ...defaultPageTypes,
        blogIndex: {
          label: 'Blog Index',
          fields: [{ name: 'heading', type: 'text' }],
        },
      }),
    })({ collections: [] } as unknown as Config)
    const pages = getPagesCollection(outputConfig)

    expect(getNamedField(pages?.fields ?? [], 'blogIndex')).toMatchObject({
      type: 'group',
      label: 'Blog Index',
      fields: [{ name: 'heading', type: 'text' }],
    })
  })

  it('allows the slug field and final fields to be overridden', () => {
    const outputConfig = pagesPlugin({
      slugField: ({ defaultSlugField }) => ({
        ...defaultSlugField,
        admin: { position: 'sidebar' },
      }),
      fields: ({ defaultFields }) => [
        ...defaultFields,
        { name: 'internalName', type: 'text' },
      ],
    })({ collections: [] } as unknown as Config)
    const pages = getPagesCollection(outputConfig)

    expect(getNamedField(pages?.fields ?? [], 'slug')).toMatchObject({
      name: 'slug',
      admin: { position: 'sidebar' },
    })
    expect(getNamedField(pages?.fields ?? [], 'internalName')).toMatchObject({
      type: 'text',
    })
  })
})
