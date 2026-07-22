import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildConfig, getPayload, type Payload } from 'payload'

import { createTemplateGetter, templatesPlugin } from '../src/index.js'

const databaseFile = join(tmpdir(), `payload-templates-${randomUUID()}.sqlite`)
let payload: Payload
let user: Record<string, unknown>

beforeAll(async () => {
  const config = await buildConfig({
    secret: 'payload-templates-integration-secret',
    db: sqliteAdapter({
      client: { url: `file:${databaseFile}` },
      push: true,
      transactionOptions: {},
    }),
    collections: [
      {
        slug: 'users',
        auth: true,
        fields: [],
      },
    ],
    plugins: [
      templatesPlugin({
        templates: [
          {
            name: '404',
            label: 'Page 404',
            fields: [{ name: 'heading', type: 'text', required: true }],
            initialData: { heading: 'Page not found' },
          },
        ],
      }),
    ],
  })

  payload = await getPayload({ config, key: `templates-integration-${databaseFile}` })
  user = await payload.create({
    collection: 'users' as never,
    data: {
      email: 'editor@example.com',
      password: 'test-password',
    } as never,
  }) as unknown as Record<string, unknown>
})

afterAll(async () => {
  await payload.db.destroy?.()
  await rm(databaseFile, { force: true })
})

describe('real Payload template persistence', () => {
  type GeneratedTemplate = {
    id: number | string
    title: string
    templateType: string
    data_404?: { heading?: string | null } | null
  }

  it('seeds one managed document and remains idempotent', async () => {
    const initial = await payload.find({
      collection: 'templates' as never,
      depth: 0,
      limit: 0,
      pagination: false,
    })

    expect(initial.docs).toHaveLength(1)
    expect(initial.docs[0]).toMatchObject({
      title: 'Page 404',
      templateType: '404',
      data_404: { heading: 'Page not found' },
    })

    await payload.config.onInit?.(payload)

    expect(await payload.count({ collection: 'templates' as never })).toMatchObject({ totalDocs: 1 })
  })

  it('denies user create and delete operations while allowing content updates', async () => {
    const { docs } = await payload.find({
      collection: 'templates' as never,
      depth: 0,
      limit: 1,
    })
    const document = docs[0] as { id: number | string }

    await expect(payload.create({
      collection: 'templates' as never,
      data: {
        data_404: { heading: 'Duplicate' },
        templateType: 'other',
        title: 'Other',
      } as never,
      overrideAccess: false,
      user: user as never,
    })).rejects.toThrow()

    const updated = await payload.update({
      collection: 'templates' as never,
      id: document.id,
      data: {
        data_404: { heading: 'Updated by user' },
        templateType: 'changed-by-user',
      } as never,
      overrideAccess: false,
      user: user as never,
    }) as unknown as { data_404: { heading: string }, templateType: string }

    expect(updated.data_404.heading).toBe('Updated by user')
    expect(updated.templateType).toBe('404')

    await expect(payload.delete({
      collection: 'templates' as never,
      id: document.id,
      overrideAccess: false,
      user: user as never,
    })).rejects.toThrow()
  })

  it('enforces templateType uniqueness at the database layer', async () => {
    await expect(payload.create({
      collection: 'templates' as never,
      data: {
        data_404: { heading: 'Duplicate' },
        templateType: '404',
        title: 'Duplicate',
      } as never,
      overrideAccess: true,
    })).rejects.toThrow()
  })

  it('fetches only the requested typed template group', async () => {
    const getTemplate = createTemplateGetter<GeneratedTemplate>(() => payload)

    const document = await getTemplate('404')

    expect(document).toMatchObject({
      data_404: { heading: expect.any(String) },
    })
    expect(document).toHaveProperty('id')
    expect(document).not.toHaveProperty('title')
    expect(document).not.toHaveProperty('templateType')
  })
})

it('fails initialization when a new template is missing required initial data', async () => {
  const invalidDatabaseFile = join(tmpdir(), `payload-templates-invalid-${randomUUID()}.sqlite`)
  const config = await buildConfig({
    secret: 'payload-templates-invalid-integration-secret',
    db: sqliteAdapter({
      client: { url: `file:${invalidDatabaseFile}` },
      push: true,
      transactionOptions: {},
    }),
    collections: [],
    plugins: [
      templatesPlugin({
        templates: [
          {
            name: 'required',
            label: 'Required',
            fields: [{ name: 'heading', type: 'text', required: true }],
          },
        ],
      }),
    ],
  })

  await expect(getPayload({
    config,
    key: `templates-invalid-integration-${invalidDatabaseFile}`,
  })).rejects.toThrow()
  await rm(invalidDatabaseFile, { force: true })
})
