import type { Config, Field, Payload } from 'payload'
import { describe, expect, expectTypeOf, it, vi } from 'vitest'

import {
  createTemplateGetter,
  templateField,
  templatesPlugin,
} from '../src/index.js'

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
  it('creates a marked template group field', () => {
    expect(templateField({ name: 'content', template: '404' })).toEqual({
      name: 'content',
      type: 'group',
      custom: {
        templateField: {
          marker: '@sittari/payload-templates/template-field',
          template: '404',
        },
      },
      fields: [],
    })
  })

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

  it('rejects unknown template fields and template composition', () => {
    expect(() =>
      templatesPlugin({ templates: definitions })({
        collections: [{
          slug: 'pages',
          fields: [templateField({ name: 'content', template: 'missing' })],
        }],
      } as unknown as Config),
    ).toThrow('Unknown template "missing"')

    expect(() =>
      templatesPlugin({
        templates: [{
          name: 'composed',
          label: 'Composed',
          fields: [templateField({ name: 'content', template: '404' })],
        }],
      })({ collections: [] } as unknown as Config),
    ).toThrow('cannot be used inside template "composed"')
  })

  it('expands template fields immutably in collections, globals, and blocks', () => {
    const requiredField = { name: 'heading', type: 'text' as const, required: true }
    const nestedRequiredField = { name: 'caption', type: 'text' as const, required: true }
    const templates = [{
      name: 'shared',
      label: 'Shared',
      fields: [
        requiredField,
        { name: 'optionalHeading', type: 'text' as const },
        {
          name: 'nested',
          type: 'group' as const,
          required: true,
          fields: [nestedRequiredField],
        },
        {
          name: 'sections',
          type: 'blocks' as const,
          blocks: [],
          blockReferences: ['referencedBlock'],
        },
      ],
    }]
    const output = templatesPlugin({ templates })({
      blocks: [{
        slug: 'sharedBlock',
        fields: [templateField({ name: 'blockContent', template: 'shared' })],
      }, {
        slug: 'referencedBlock',
        fields: [{ name: 'body', type: 'text', required: true }],
      }],
      collections: [{
        slug: 'pages',
        fields: [{
          name: 'items',
          type: 'array',
          fields: [templateField({ name: 'content', template: 'shared' })],
        }],
      }],
      globals: [{
        slug: 'header',
        fields: [templateField({ name: 'content', template: 'shared' })],
      }],
    } as unknown as Config) as Config

    const pages = output.collections?.find(({ slug }) => slug === 'pages')
    const items = getNamedField(pages?.fields ?? [], 'items')
    if (!items || items.type !== 'array') {
      throw new Error('Expected items array')
    }
    const collectionContent = getNamedField(items.fields, 'content')
    const globalContent = getNamedField(output.globals?.[0]?.fields ?? [], 'content')
    const blockContent = getNamedField(output.blocks?.[0]?.fields ?? [], 'blockContent')

    for (const content of [collectionContent, globalContent, blockContent]) {
      if (!content || content.type !== 'group' || !('name' in content)) {
        throw new Error('Expected expanded template group')
      }
      const heading = getNamedField(content.fields, 'heading')
      const optionalHeading = getNamedField(content.fields, 'optionalHeading')
      const nested = getNamedField(content.fields, 'nested')
      expect(heading).toMatchObject({ required: false })
      expect(optionalHeading).toMatchObject({ required: false })
      expect(nested).toMatchObject({ required: false })
      if (!nested || nested.type !== 'group') {
        throw new Error('Expected nested group')
      }
      expect(getNamedField(nested.fields, 'caption')).toMatchObject({ required: false })
      const sections = getNamedField(content.fields, 'sections')
      if (!sections || sections.type !== 'blocks') {
        throw new Error('Expected sections blocks field')
      }
      const referencedBlock = sections.blockReferences?.[0]
      if (!referencedBlock || typeof referencedBlock === 'string') {
        throw new Error('Expected resolved reusable block')
      }
      expect(getNamedField(referencedBlock.fields, 'body')).toMatchObject({ required: false })
      expect(content.hooks?.afterRead).toHaveLength(1)
    }

    expect(requiredField.required).toBe(true)
    expect(nestedRequiredField.required).toBe(true)
    const managedFields = getTemplatesCollection(output)?.fields ?? []
    const managedData = getNamedField(managedFields, 'data_shared')
    if (!managedData || managedData.type !== 'group') {
      throw new Error('Expected managed template data')
    }
    expect(getNamedField(managedData.fields, 'heading')).toBe(requiredField)
  })

  it('fills empty values deeply, treats lists atomically, and caches lookups', async () => {
    const templates = [{
      name: 'defaults',
      label: 'Defaults',
      fields: [
        { name: 'heading', type: 'text' as const, required: true },
        {
          name: 'localizedHeading',
          type: 'text' as const,
          localized: true,
          required: true,
        },
        { name: 'whitespace', type: 'text' as const },
        { name: 'enabled', type: 'checkbox' as const, required: true },
        { name: 'count', type: 'number' as const, required: true },
        {
          name: 'nested',
          type: 'group' as const,
          fields: [
            { name: 'title', type: 'text' as const, required: true },
            { name: 'description', type: 'textarea' as const },
          ],
        },
        {
          name: 'items',
          type: 'array' as const,
          fields: [{ name: 'label', type: 'text' as const, required: true }],
        },
        { name: 'metadata', type: 'json' as const },
      ],
    }]
    const output = templatesPlugin({ templates })({
      collections: [{
        slug: 'pages',
        fields: [templateField({ name: 'content', template: 'defaults' })],
      }],
    } as unknown as Config) as Config
    const pages = output.collections?.find(({ slug }) => slug === 'pages')
    const content = getNamedField(pages?.fields ?? [], 'content')
    if (!content || content.type !== 'group' || !('name' in content)) {
      throw new Error('Expected content group')
    }
    const hook = content.hooks?.afterRead?.[0]
    if (!hook) {
      throw new Error('Expected fallback hook')
    }

    const find = vi.fn(async () => ({
      docs: [{
        data_defaults: {
          heading: 'Default heading',
          localizedHeading: {
            en: 'Default English heading',
            uk: 'Default Ukrainian heading',
          },
          whitespace: 'Default whitespace',
          enabled: true,
          count: 7,
          nested: {
            title: 'Default title',
            description: 'Default description',
          },
          items: [{ label: 'Default item' }],
          metadata: { source: 'template' },
        },
      }],
    }))
    const warn = vi.fn()
    const context = {}
    const req = {
      context,
      fallbackLocale: 'en',
      locale: 'uk',
      payload: {
        find,
        logger: { warn },
      },
    }
    const local = {
      heading: '',
      localizedHeading: {
        en: '',
        uk: 'Local Ukrainian heading',
      },
      whitespace: '   ',
      enabled: false,
      count: 0,
      nested: {
        title: null,
        description: 'Local description',
        localOnly: 'preserved',
      },
      items: [],
      metadata: {},
    }

    await expect(hook({
      context,
      field: content,
      req,
      siblingData: { content: local },
      value: local,
    } as never)).resolves.toEqual({
      heading: 'Default heading',
      localizedHeading: {
        en: 'Default English heading',
        uk: 'Local Ukrainian heading',
      },
      whitespace: '   ',
      enabled: false,
      count: 0,
      nested: {
        title: 'Default title',
        description: 'Local description',
        localOnly: 'preserved',
      },
      items: [{ label: 'Default item' }],
      metadata: { source: 'template' },
    })

    const localItems = [{ label: '' }]
    await expect(hook({
      context,
      field: content,
      req,
      siblingData: { content: { items: localItems } },
      value: { items: localItems },
    } as never)).resolves.toMatchObject({ items: localItems })

    expect(find).toHaveBeenCalledOnce()
    expect(find).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'templates',
      depth: 0,
      fallbackLocale: 'en',
      locale: 'all',
      req,
      select: { data_defaults: true },
    }))
    expect(warn).not.toHaveBeenCalled()
  })

  it('resolves locale-all reads per locale and warns once for a missing template document', async () => {
    const output = templatesPlugin({ templates: definitions })({
      globals: [{
        slug: 'header',
        fields: [templateField({ name: 'content', template: '404' })],
      }],
    } as unknown as Config) as Config
    const content = getNamedField(output.globals?.[0]?.fields ?? [], 'content')
    if (!content || content.type !== 'group' || !('name' in content)) {
      throw new Error('Expected content group')
    }
    const hook = content.hooks?.afterRead?.[0]
    if (!hook) {
      throw new Error('Expected fallback hook')
    }

    const find = vi.fn(async () => ({ docs: [] }))
    const warn = vi.fn()
    const context = {}
    const english = { heading: '' }
    const ukrainian = { heading: '' }
    const req = {
      context,
      fallbackLocale: null,
      locale: 'all',
      payload: {
        find,
        logger: { warn },
      },
    }
    const siblingData = {
      content: {
        en: english,
        uk: ukrainian,
      },
    }

    await hook({
      context,
      field: content,
      req,
      siblingData,
      value: english,
    } as never)
    await hook({
      context,
      field: content,
      req,
      siblingData,
      value: english,
    } as never)

    expect(find).toHaveBeenCalledOnce()
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ locale: 'en' }))
    expect(warn).toHaveBeenCalledOnce()
    expect(req.locale).toBe('all')
  })

  it('keeps Admin form reads raw and supports explicit resolution modes', async () => {
    const output = templatesPlugin({ templates: definitions })({
      collections: [{
        slug: 'pages',
        fields: [templateField({ name: 'content', template: '404' })],
      }],
    } as unknown as Config) as Config
    const pages = output.collections?.find(({ slug }) => slug === 'pages')
    const content = getNamedField(pages?.fields ?? [], 'content')
    if (!content || content.type !== 'group' || !('name' in content)) {
      throw new Error('Expected content group')
    }
    const hook = content.hooks?.afterRead?.[0]
    if (!hook) {
      throw new Error('Expected fallback hook')
    }

    const find = vi.fn(async () => ({
      docs: [{ data_404: { heading: 'Default heading' } }],
    }))
    const local = { heading: '' }
    const runHook = ({
      context = {},
      pathname = '/api/pages/1',
      referrer,
    }: {
      context?: Record<string, unknown>
      pathname?: string
      referrer?: string
    }) => {
      const req = {
        context,
        fallbackLocale: null,
        headers: new Headers(referrer ? { referer: referrer } : undefined),
        locale: 'en',
        pathname,
        payload: {
          config: {
            routes: { admin: '/cms-admin/' },
          },
          find,
          logger: { warn: vi.fn() },
        },
      }

      return hook({
        context,
        field: content,
        req,
        siblingData: { content: local },
        value: local,
      } as never)
    }

    await expect(runHook({
      pathname: '/cms-admin/collections/pages/1',
    })).resolves.toBe(local)
    await expect(runHook({
      referrer: 'https://cms.example.com/cms-admin/collections/pages/1',
    })).resolves.toBe(local)
    await expect(runHook({
      context: { templateFields: 'raw' },
    })).resolves.toBe(local)

    await expect(runHook({
      context: { templateFields: 'resolved' },
      pathname: '/cms-admin/collections/pages/1',
    })).resolves.toEqual({ heading: 'Default heading' })
    await expect(runHook({
      referrer: 'https://cms.example.com/cms-admin/collections/pages/1/api',
    })).resolves.toEqual({ heading: 'Default heading' })
    await expect(runHook({
      referrer: 'https://www.example.com/pages/example',
    })).resolves.toEqual({ heading: 'Default heading' })

    expect(find).toHaveBeenCalledTimes(3)
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

  it('reconciles once on the first collection operation after config hot reload', async () => {
    const create = vi.fn(async () => undefined)
    const find = vi.fn(async (_options?: { context?: Record<string, unknown> }) => ({
      docs: [],
    }))
    const payload = {
      create,
      delete: vi.fn(async () => undefined),
      find,
      update: vi.fn(async () => undefined),
    } as unknown as Payload
    const output = applyPlugin({ collections: [] } as unknown as Config)
    const beforeOperation = getTemplatesCollection(output)?.hooks?.beforeOperation?.[0]

    expect(beforeOperation).toBeDefined()

    const runHook = () => beforeOperation?.({
      context: {},
      req: { payload },
    } as never)

    await Promise.all([runHook(), runHook()])
    await runHook()

    expect(find).toHaveBeenCalledOnce()
    expect(create).toHaveBeenCalledTimes(definitions.length)
  })

  it('skips reconciliation hooks triggered by its own local API operations', async () => {
    const create = vi.fn(async () => undefined)
    const find = vi.fn(async (_options: { context?: Record<string, unknown> }) => ({
      docs: [],
    }))
    const payload = {
      create,
      delete: vi.fn(async () => undefined),
      find,
      update: vi.fn(async () => undefined),
    } as unknown as Payload
    const output = applyPlugin({ collections: [] } as unknown as Config)
    const beforeOperation = getTemplatesCollection(output)?.hooks?.beforeOperation?.[0]

    await beforeOperation?.({
      context: {},
      req: { payload },
    } as never)

    const reconciliationContext = find.mock.calls[0]?.[0]?.context
    if (!reconciliationContext) {
      throw new Error('Expected reconciliation context')
    }

    await beforeOperation?.({
      context: reconciliationContext,
      req: { payload },
    } as never)

    expect(reconciliationContext).toEqual({ sittariTemplatesReconcile: true })
    expect(find).toHaveBeenCalledOnce()
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
