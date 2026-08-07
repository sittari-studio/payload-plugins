import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const databaseFile = join(
  tmpdir(),
  `sittari-dev-nested-paths-${randomUUID()}.sqlite`,
)
let payload: Payload

beforeAll(async () => {
  process.env.DATABASE_URL = `file:${databaseFile}`
  const { default: config } = await import('./payload.config.js')
  payload = await getPayload({
    config,
    disableOnInit: true,
    key: `dev-nested-paths-${databaseFile}`,
  })
})

afterAll(async () => {
  await payload.destroy()
  await rm(databaseFile, { force: true })
})

describe('dev nested category paths', () => {
  it('stores hierarchical paths and propagates parent path changes', async () => {
    const root = await payload.create({
      collection: 'categories',
      data: {
        slug: 'apparel',
        title: 'Apparel',
      },
    })
    const child = await payload.create({
      collection: 'categories',
      data: {
        parent: root.id,
        slug: 'shoes',
        title: 'Shoes',
      },
    })

    expect(root.path).toBe('/categories/apparel')
    expect(child.path).toBe('/categories/apparel/shoes')

    await payload.update({
      collection: 'categories',
      data: {
        slug: 'clothing',
      },
      id: root.id,
    })
    const updatedChild = await payload.findByID({
      collection: 'categories',
      id: child.id,
    })

    expect(updatedChild.path).toBe('/categories/clothing/shoes')
  })
})
