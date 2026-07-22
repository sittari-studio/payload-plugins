import type { Config, Field, Payload } from 'payload'
import { describe, expect, expectTypeOf, it, vi } from 'vitest'

import { createTemplateGetter, templatesPlugin } from '../src/index.js'

const definitions = [
  {
    name: '404',
    label: 'Page 404',
    fields: [{ name: 'heading', type: 'text' as const, required: true }],
    initialData: { heading: 'Page not found' },
  },
  {
    name: 'home',
    label: 'Home',
    fields: [{ name: 'heading', type: 'text' as const }],
  },
]

const getTemplatesCollection = (config: Config) =>
  config.collections?.find(({ slug }) => slug === 'templates')

const getNamedField = (fields: Field[], name: string) =>
  fields.find((field) => 'name' in field && field.name === name)

const applyPlugin = (config: Config) =>
  templatesPlugin({ templates: definitions })(config) as Config

describe('templatesPlugin', () => {
  it('adds a protected templates collection and preserves existing collections', () => {
    const existingCollection = { slug: 'posts', fields: [] }
    const output = applyPlugin({
      collections: [existingCollection],
    } as unknown as Config)
    const collection = getTemplatesCollection(output)

    expect(output.collections?.[0]).toBe(existingCollection)
    expect(collection).toMatchObject({
      slug: 'templates',
      disableDuplicate: true,
      admin: {
        defaultColumns: ['title', 'updatedAt'],
        useAsTitle: 'title',
      },
    })
    expect(collection?.access?.create?.({} as never)).toBe(false)
    expect(collection?.access?.delete?.({} as never)).toBe(false)
  })

  it('generates protected identity fields and conditional template data groups', () => {
    const output = applyPlugin({ collections: [] } as unknown as Config)
    const fields = getTemplatesCollection(output)?.fields ?? []
    const title = getNamedField(fields, 'title')
    const templateType = getNamedField(fields, 'templateType')
    const notFoundData = getNamedField(fields, 'data_404')

    expect(title).toMatchObject({
      type: 'text',
      required: true,
      admin: { hidden: true, readOnly: true },
    })
    expect(templateType).toMatchObject({
      type: 'text',
      required: true,
      unique: true,
      admin: { hidden: true, readOnly: true },
    })
    if (!templateType || !('access' in templateType)) {
      throw new Error('Expected templateType to be a data field')
    }
    expect(templateType.access?.create?.({} as never)).toBe(false)
    expect(templateType.access?.update?.({} as never)).toBe(false)
    expect(notFoundData).toMatchObject({
      type: 'group',
      label: false,
      fields: definitions[0].fields,
      admin: { hideGutter: true },
    })

    if (!notFoundData || notFoundData.type !== 'group') {
      throw new Error('Expected data_404 to be a group field')
    }
    expect(notFoundData.admin?.condition?.({}, { templateType: '404' }, {} as never)).toBe(true)
    expect(notFoundData.admin?.condition?.({}, { templateType: 'home' }, {} as never)).toBe(false)
  })

  it('returns the incoming config unchanged when disabled', () => {
    const input = { collections: [] } as unknown as Config

    expect(templatesPlugin({ enabled: false, templates: definitions })(input)).toBe(input)
  })

  it.each([
    {
      templates: [{ name: '', label: 'Empty', fields: [] }],
      message: 'Invalid template name',
    },
    {
      templates: [{ name: 'page-404', label: 'Invalid characters', fields: [] }],
      message: 'Invalid template name',
    },
    {
      templates: [
        { name: 'duplicate', label: 'First', fields: [] },
        { name: 'duplicate', label: 'Second', fields: [] },
      ],
      message: 'must be unique',
    },
  ])('rejects invalid template definitions', ({ templates, message }) => {
    expect(() =>
      templatesPlugin({ templates })({ collections: [] } as unknown as Config),
    ).toThrow(message)
  })

  it('rejects an existing templates collection', () => {
    expect(() =>
      templatesPlugin({ templates: definitions })({
        collections: [{ slug: 'templates', fields: [] }],
      } as unknown as Config),
    ).toThrow('already exists')
  })

  it('chains onInit and reconciles missing, renamed, relabeled, and invalid documents', async () => {
    const events: string[] = []
    const create = vi.fn(async () => undefined)
    const update = vi.fn(async () => undefined)
    const remove = vi.fn(async () => undefined)
    const payload = {
      create,
      delete: remove,
      find: vi.fn(async () => ({
        docs: [
          { id: 1, templateType: '404', title: 'Old 404 label' },
          { id: 2, templateType: 'removed', title: 'Removed' },
          { id: 3, title: 'Missing identity' },
        ],
      })),
      update,
    } as unknown as Payload
    const incomingOnInit = vi.fn(async () => {
      events.push('incoming')
    })
    const output = applyPlugin({
      collections: [],
      onInit: incomingOnInit,
    } as unknown as Config)

    await output.onInit?.(payload)

    expect(events).toEqual(['incoming'])
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'templates',
      data: {
        data_home: {},
        templateType: 'home',
        title: 'Home',
      },
      overrideAccess: true,
    }))
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'templates',
      id: 1,
      data: { title: 'Page 404' },
      overrideAccess: true,
    }))
    expect(remove).toHaveBeenCalledTimes(2)
    expect(remove).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }))
    expect(remove).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }))
  })
})

describe('createTemplateGetter', () => {
  type GeneratedTemplate = {
    id: number
    title: string
    templateType: string
    data_404?: {
      heading?: string | null
    } | null
    data_home?: {
      heading?: string | null
    } | null
  }

  it('finds by templateType and selects only the matching group field', async () => {
    const find = vi.fn(async () => ({
      docs: [{ id: 1, data_404: { heading: 'Page not found' } }],
    }))
    const getPayload = vi.fn(async () => ({ find }) as unknown as Payload)
    const getTemplate = createTemplateGetter<GeneratedTemplate>(getPayload)

    const document = await getTemplate('404')

    expect(getPayload).toHaveBeenCalledOnce()
    expect(find).toHaveBeenCalledWith({
      collection: 'templates',
      depth: 0,
      limit: 1,
      pagination: false,
      select: {
        data_404: true,
      },
      where: {
        templateType: {
          equals: '404',
        },
      },
    })
    expect(document).toEqual({ id: 1, data_404: { heading: 'Page not found' } })
    expectTypeOf(document).toEqualTypeOf<
      Pick<GeneratedTemplate, 'id' | 'data_404'> | null
    >()
  })

  it('returns null when no template document exists', async () => {
    const payload = {
      find: vi.fn(async () => ({ docs: [] })),
    } as unknown as Payload
    const getTemplate = createTemplateGetter<GeneratedTemplate>(() => payload)

    await expect(getTemplate('home')).resolves.toBeNull()
  })
})
