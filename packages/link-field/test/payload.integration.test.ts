import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { configToSchema } from '@payloadcms/graphql'
import {
  convertLexicalToHTML,
  convertLexicalToMarkdown,
  defaultHTMLConverters,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Block, Field, GroupField, TextField } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildConfig, createLocalReq, getPayload, type Payload } from 'payload'

import { LinkFieldFeature, linkField, linkFieldPlugin } from '../src/index.js'

const { graphql } = createRequire(import.meta.url)('graphql') as typeof import('graphql')

const editor = lexicalEditor({
  features: ({ defaultFeatures }) => [
    ...defaultFeatures.filter((feature) => feature.key !== 'link'),
    LinkFieldFeature({ relationTo: 'pages' }),
  ],
})

const richTextValue = (link: Record<string, unknown>) => ({
  root: {
    children: [
      {
        children: [link],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'paragraph',
        version: 1,
      },
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
})

const textChild = (text: string) => ({
  detail: 0,
  format: 0,
  mode: 'normal',
  style: '',
  text,
  type: 'text',
  version: 1,
})

const databaseFile = join(tmpdir(), `payload-link-field-${randomUUID()}.sqlite`)
let payload: Payload

const reusableBlock: Block = {
  slug: 'reusableLink',
  admin: {
    group: 'Reusable blocks',
  },
  fields: [
    linkField({
      name: 'link',
      relationTo: 'pages',
    }),
  ],
}

const inlineBlock: Block = {
  slug: 'inlineLink',
  fields: [linkField({ name: 'link' })],
}

const getNamedField = <TField extends Field>(fields: Field[], name: string): TField => {
  const field = fields.find((candidate) => 'name' in candidate && candidate.name === name)

  if (!field) {
    throw new Error(`Missing field ${name}`)
  }

  return field as TField
}

beforeAll(async () => {
  const config = await buildConfig({
    secret: 'payload-link-field-integration-secret',
    db: sqliteAdapter({
      client: { url: `file:${databaseFile}` },
      push: true,
      transactionOptions: {},
    }),
    blocks: [reusableBlock],
    collections: [
      {
        slug: 'pages',
        access: {
          read: () => true,
        },
        fields: [
          {
            name: 'title',
            type: 'text',
            required: true,
          },
          {
            name: 'slug',
            type: 'text',
            required: true,
          },
          {
            name: 'content',
            type: 'richText',
            editor,
          },
          {
            name: 'referencedLayout',
            type: 'blocks',
            blocks: [],
            blockReferences: ['reusableLink'],
          },
          {
            name: 'inlineLayout',
            type: 'blocks',
            blocks: [inlineBlock],
          },
        ],
      },
    ],
    globals: [
      {
        slug: 'settings',
        fields: [linkField({ name: 'globalLink' })],
      },
    ],
    plugins: [
      linkFieldPlugin({
        resolveDocumentUrl: ({ document }) =>
          document && typeof document.slug === 'string' ? `/pages/${document.slug}` : null,
      }),
    ],
  })

  payload = await getPayload({ config, key: `link-field-integration-${databaseFile}` })
})

afterAll(async () => {
  await payload.db.destroy?.()
  await rm(databaseFile, { force: true })
})

describe('real Payload reusable block resolution', () => {
  it('attaches one resolver and returns resolved URLs for referenced and inline blocks', async () => {
    const configuredBlock = payload.config.blocks?.find(
      (block) => block.slug === reusableBlock.slug,
    )
    const configuredLink = configuredBlock?.fields[0] as GroupField | undefined

    if (!configuredLink) {
      throw new Error('Missing configured reusable link block')
    }

    expect(configuredBlock?.admin?.group).toBe('Reusable blocks')
    expect(getNamedField<TextField>(configuredLink.fields, 'url').hooks?.afterRead).toHaveLength(1)

    const target = await payload.create({
      collection: 'pages',
      data: {
        slug: 'target',
        title: 'Target',
      },
    })
    const created = await payload.create({
      collection: 'pages',
      data: {
        inlineLayout: [
          {
            blockType: 'inlineLink',
            link: {
              customUrl: '/inline',
              type: 'custom',
            },
          },
        ],
        referencedLayout: [
          {
            blockType: 'reusableLink',
            link: {
              reference: target.id,
              type: 'reference',
            },
          },
        ],
        slug: 'source',
        title: 'Source',
      },
    }) as unknown as {
      id: number | string
      inlineLayout?: Array<{ link?: { url?: null | string } }>
      referencedLayout?: Array<{ link?: { url?: null | string } }>
    }

    expect(created.referencedLayout?.[0]?.link?.url).toBe('/pages/target')
    expect(created.inlineLayout?.[0]?.link?.url).toBe('/inline')

    const returned = await payload.findByID({
      collection: 'pages',
      id: created.id,
    }) as unknown as typeof created

    expect(returned.referencedLayout?.[0]?.link?.url).toBe('/pages/target')
    expect(returned.inlineLayout?.[0]?.link?.url).toBe('/inline')
  })

  it('keeps global link resolution functional', async () => {
    const updated = await payload.updateGlobal({
      slug: 'settings',
      data: {
        globalLink: {
          customUrl: '/global',
          type: 'custom',
        },
      },
    }) as unknown as { globalLink?: { url?: null | string } }

    expect(updated.globalLink?.url).toBe('/global')

    const returned = await payload.findGlobal({
      slug: 'settings',
    }) as unknown as typeof updated

    expect(returned.globalLink?.url).toBe('/global')
  })

  it('exposes the virtual URL in generated GraphQL object types', () => {
    const { schema } = configToSchema(payload.config)
    const linkObjectTypes = Object.values(schema.getTypeMap()).filter((type) => {
      if (type.constructor.name !== 'GraphQLObjectType' || !('getFields' in type)) {
        return false
      }

      const fields = (type as { getFields: () => Record<string, unknown> }).getFields()

      return 'customUrl' in fields && 'reference' in fields && 'type' in fields
    }) as Array<{ getFields: () => Record<string, unknown> }>

    expect(linkObjectTypes.length).toBeGreaterThanOrEqual(3)
    expect(linkObjectTypes.every((type) => 'url' in type.getFields())).toBe(true)
  })
})

describe('real Payload Lexical link feature', () => {
  it('sanitizes shared node fields and uses the package client import', () => {
    const content = payload.config.collections[0].fields.find(
      (field) => 'name' in field && field.name === 'content',
    ) as any
    const feature = content.editor.editorConfig.resolvedFeatureMap.get('link')
    const linkNode = feature.nodes.find((entry: any) => entry.node.getType() === 'link')
    const fields = linkNode.getSubFields()
    const reference = fields.find((field: any) => field.name === 'reference')

    expect(feature.ClientFeature).toBe(
      '@sittari/payload-link-field/client#LinkFieldFeatureClient',
    )
    expect(feature.clientFeatureProps).toMatchObject({
      defaultType: 'custom',
      showLabel: true,
      showNewTab: true,
    })
    expect(reference.relationTo).toBe('pages')
    expect(fields.find((field: any) => field.name === 'customUrl').required).toBe(true)
    expect(fields.find((field: any) => field.name === 'url')).toMatchObject({
      type: 'text',
      virtual: true,
    })
    expect(content.editor.editorConfig.features.converters.html.some(
      (converter: any) => converter.nodeTypes.includes('link'),
    )).toBe(true)
  })

  it('normalizes native nodes, synchronizes labels, and resolves custom URLs', async () => {
    const created = await payload.create({
      collection: 'pages',
      data: {
        content: richTextValue({
          children: [textChild('Legacy link')],
          direction: null,
          fields: {
            linkType: 'custom',
            newTab: true,
            url: '/legacy',
          },
          format: '',
          indent: 0,
          type: 'link',
          version: 3,
        }),
        slug: 'legacy-link',
        title: 'Legacy link page',
      },
    }) as any

    const node = created.content.root.children[0].children[0]
    expect(node).toMatchObject({
      fields: {
        customUrl: '/legacy',
        label: 'Legacy link',
        newTab: true,
        type: 'custom',
        url: '/legacy',
      },
      type: 'link',
      version: 1,
    })
    expect(node.fields).not.toHaveProperty('linkType')
    expect(node.fields).not.toHaveProperty('doc')
  })

  it('populates references and generated URLs on REST reads', async () => {
    const target = await payload.create({
      collection: 'pages',
      data: { slug: 'lexical-target', title: 'Lexical target' },
    })
    const source = await payload.create({
      collection: 'pages',
      data: {
        content: richTextValue({
          children: [textChild('Target page')],
          direction: null,
          fields: {
            reference: target.id,
            type: 'reference',
          },
          format: '',
          indent: 0,
          type: 'link',
          version: 1,
        }),
        slug: 'lexical-source',
        title: 'Lexical source',
      },
    }) as any

    const returned = await payload.findByID({
      collection: 'pages',
      depth: 1,
      id: source.id,
    }) as any
    const fields = returned.content.root.children[0].children[0].fields
    expect(fields.label).toBe('Target page')
    expect(fields.reference).toMatchObject({ id: target.id, slug: 'lexical-target' })
    expect(fields.url).toBe('/pages/lexical-target')
  })

  it('populates references and generated URLs on GraphQL reads', async () => {
    const target = await payload.create({
      collection: 'pages',
      data: { slug: 'graphql-target', title: 'GraphQL target' },
    })
    const source = await payload.create({
      collection: 'pages',
      data: {
        content: richTextValue({
          children: [textChild('GraphQL target')],
          direction: null,
          fields: { reference: target.id, type: 'reference' },
          format: '',
          indent: 0,
          type: 'link',
          version: 1,
        }),
        slug: 'graphql-source',
        title: 'GraphQL source',
      },
    })
    const { schema } = configToSchema(payload.config)
    const req = await createLocalReq({}, payload)
    const result = await graphql({
      contextValue: { req },
      schema,
      source: `query { Pages(where: { id: { equals: ${JSON.stringify(source.id)} } }) { docs { content } } }`,
    })

    expect(result.errors).toBeUndefined()
    const node = (result.data as any).Pages.docs[0].content.root.children[0].children[0]
    expect(node.fields.reference).toMatchObject({ id: target.id, slug: 'graphql-target' })
    expect(node.fields.url).toBe('/pages/graphql-target')
  })

  it('rejects unsafe custom URLs and self references', async () => {
    await expect(payload.create({
      collection: 'pages',
      data: {
        content: richTextValue({
          children: [textChild('Unsafe')],
          direction: null,
          fields: { customUrl: 'javascript:alert(1)', type: 'custom' },
          format: '',
          indent: 0,
          type: 'link',
          version: 1,
        }),
        slug: 'unsafe-link',
        title: 'Unsafe link',
      },
    })).rejects.toThrow()

    const page = await payload.create({
      collection: 'pages',
      data: { slug: 'self-link', title: 'Self link' },
    })
    await expect(payload.update({
      collection: 'pages',
      id: page.id,
      data: {
        content: richTextValue({
          children: [textChild('Self')],
          direction: null,
          fields: { reference: page.id, type: 'reference' },
          format: '',
          indent: 0,
          type: 'link',
          version: 1,
        }),
      },
    })).rejects.toThrow()
  })

  it('serializes custom and reference links to HTML and Markdown', async () => {
    const content = payload.config.collections[0].fields.find(
      (field) => 'name' in field && field.name === 'content',
    ) as any
    const editorConfig = content.editor.editorConfig
    const custom = richTextValue({
      children: [textChild('About')],
      direction: null,
      fields: { customUrl: '/about', newTab: true, type: 'custom' },
      format: '',
      indent: 0,
      type: 'link',
      version: 1,
    }) as any
    const reference = richTextValue({
      children: [textChild('Post')],
      direction: null,
      fields: { reference: 1, type: 'reference', url: '/posts/one' },
      format: '',
      indent: 0,
      type: 'link',
      version: 1,
    }) as any

    await expect(convertLexicalToHTML({
      converters: [...defaultHTMLConverters, ...editorConfig.features.converters.html],
      data: custom,
      req: null,
    })).resolves.toContain(
      '<a href="/about" rel="noopener noreferrer" target="_blank">About</a>',
    )
    await expect(convertLexicalToHTML({
      converters: [...defaultHTMLConverters, ...editorConfig.features.converters.html],
      data: reference,
      req: null,
    })).resolves.toContain('<a href="/posts/one">Post</a>')
    expect(convertLexicalToMarkdown({ data: custom, editorConfig })).toContain(
      '[About](/about)',
    )
    expect(convertLexicalToMarkdown({ data: reference, editorConfig })).toContain(
      '[Post](/posts/one)',
    )
  })

  it('saves a newly inserted link that has no corresponding original node', async () => {
    const created = await payload.create({
      collection: 'pages',
      data: {
        content: richTextValue(textChild('Initial text')),
        slug: 'insert-link-later',
        title: 'Insert link later',
      },
    })

    const updated = await payload.update({
      collection: 'pages',
      data: {
        content: richTextValue({
          children: [textChild('About')],
          direction: null,
          fields: {
            customUrl: '/about',
            label: 'About',
            newTab: false,
            type: 'custom',
          },
          format: '',
          id: 'new-link-node',
          indent: 0,
          type: 'link',
          version: 1,
        }),
      },
      id: created.id,
    }) as any

    expect(updated.content.root.children[0].children[0]).toMatchObject({
      fields: {
        customUrl: '/about',
        type: 'custom',
      },
      type: 'link',
    })
  })
})
