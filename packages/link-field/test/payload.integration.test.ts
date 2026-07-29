import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { configToSchema } from '@payloadcms/graphql'
import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Block, Field, GroupField, TextField } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildConfig, getPayload, type Payload } from 'payload'

import { linkField, linkFieldPlugin } from '../src/index.js'

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
