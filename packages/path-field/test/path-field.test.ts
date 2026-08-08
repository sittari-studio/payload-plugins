import { ValidationError, type Config, type Field, type Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import {
  buildPaginatedPath,
  cleanPathSegment,
  isValidDocumentPath,
  joinPathSegments,
  parsePaginatedPath,
  pathFieldPlugin,
  validateDocumentPath,
} from '../src/index.js'
import { PATH_REBUILD_CONTEXT_KEY } from '../src/types.js'

const baseConfig = (): Config => ({
  collections: [
    {
      slug: 'pages',
      fields: [
        { name: 'slug', type: 'text' },
        {
          name: 'parent',
          type: 'relationship',
          relationTo: 'pages',
        },
      ],
    },
  ],
  localization: {
    defaultLocale: 'en',
    locales: ['en', 'uk'],
  },
}) as unknown as Config

const getPathField = (config: Config): Field | undefined =>
  config.collections?.[0]?.fields.find(
    (field) => 'name' in field && field.name === 'path',
  )

describe('pathFieldPlugin', () => {
  it('adds a nullable localized generated field and appends its hook', () => {
    const existingHook = vi.fn()
    const config = baseConfig()
    config.collections![0]!.hooks = { beforeChange: [existingHook] }

    const output = pathFieldPlugin({
      collections: { pages: { parentField: 'parent' } },
      resolveDocumentUrl: ({ doc, locale }) => `/${locale}/${String(doc.slug)}`,
    })(config) as Config

    expect(getPathField(output)).toMatchObject({
      name: 'path',
      type: 'text',
      localized: true,
      unique: true,
      index: true,
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    })
    expect('required' in (getPathField(output) ?? {})).toBe(false)
    expect(getPathField(output)?.admin?.custom).toBeUndefined()
    expect(output.collections?.[0]?.hooks?.beforeChange?.[0]).toBe(existingHook)
    expect(output.collections?.[0]?.hooks?.beforeChange).toHaveLength(2)
  })

  it('returns the original config unchanged when disabled', () => {
    const config = baseConfig()
    expect(
      pathFieldPlugin({
        collections: { missing: true },
        enabled: false,
        resolveDocumentUrl: () => '/',
      })(config),
    ).toBe(config)
  })

  it('requires nested-docs parent fields to exist before this plugin runs', () => {
    const config = baseConfig()
    config.collections![0]!.fields = [{ name: 'slug', type: 'text' }]

    expect(() =>
      pathFieldPlugin({
        collections: { pages: { parentField: 'parent' } },
        resolveDocumentUrl: () => '/',
      })(config),
    ).toThrow(/Configure nested-docs before pathFieldPlugin/)
  })

  it('rejects user-owned path fields and invalid parent relationships', () => {
    const collision = baseConfig()
    collision.collections![0]!.fields.push({ name: 'path', type: 'text' })
    expect(() =>
      pathFieldPlugin({
        collections: { pages: true },
        resolveDocumentUrl: () => '/',
      })(collision),
    ).toThrow(/already has a field named "path"/)

    const wrongParent = baseConfig()
    wrongParent.collections![0]!.fields[1] = {
      name: 'parent',
      type: 'relationship',
      relationTo: 'other' as never,
    }
    expect(() =>
      pathFieldPlugin({
        collections: { pages: { parentField: 'parent' } },
        resolveDocumentUrl: () => '/',
      })(wrongParent),
    ).toThrow(/must relate to "pages"/)
  })

  it('rejects path collisions nested inside field containers', () => {
    const config = baseConfig()
    config.collections![0]!.fields.push({
      type: 'tabs',
      tabs: [
        {
          label: 'Routing',
          fields: [{ name: 'path', type: 'text' }],
        },
      ],
    })

    expect(() =>
      pathFieldPlugin({
        collections: { pages: true },
        resolveDocumentUrl: () => '/',
      })(config),
    ).toThrow(/already has a field named "path"/)
  })

  it('composes the existing onInit before plugin initialization', async () => {
    const order: string[] = []
    const config = baseConfig()
    config.onInit = () => {
      order.push('existing')
    }
    const output = pathFieldPlugin({
      collections: { pages: true },
      resolveDocumentUrl: () => '/',
    })(config) as Config
    const payload = {
      config: output,
      find: vi.fn(async () => ({ docs: [], hasNextPage: false })),
    } as unknown as Payload

    await output.onInit?.(payload)
    expect(order).toEqual(['existing'])
    expect(payload.find).toHaveBeenCalled()
  })

  it('validates generated fields after later plugins wrap them in tabs', async () => {
    const output = pathFieldPlugin({
      collections: { pages: { parentField: 'parent' } },
      resolveDocumentUrl: () => '/',
    })(baseConfig()) as Config
    const pages = output.collections?.[0]
    if (!pages) throw new Error('Missing pages collection')

    pages.fields = [
      {
        type: 'tabs',
        tabs: [
          {
            label: 'Content',
            fields: pages.fields,
          },
        ],
      },
    ]
    const payload = {
      config: output,
      find: vi.fn(async () => ({ docs: [], hasNextPage: false })),
    } as unknown as Payload

    await expect(output.onInit?.(payload)).resolves.toBeUndefined()
  })

  it('replaces client paths and resolves every locale for locale all', async () => {
    const resolver = vi.fn(({ doc, locale }) => `/${locale}/${String(doc.slug)}`)
    const output = pathFieldPlugin({
      collections: { pages: true },
      resolveDocumentUrl: resolver,
    })(baseConfig()) as Config
    const hook = output.collections?.[0]?.hooks?.beforeChange?.at(-1)
    const result = await hook?.({
      collection: {} as never,
      context: {},
      data: {
        path: { en: '/client', uk: '/client' },
        slug: { en: 'about', uk: 'pro-nas' },
      },
      operation: 'create',
      req: {
        locale: 'all',
        payload: {},
      } as never,
    })

    expect(result.path).toEqual({
      en: '/en/about',
      uk: '/uk/pro-nas',
    })
    expect(resolver).toHaveBeenCalledTimes(2)
  })

  it('allows initial document creation when no path can be resolved yet', async () => {
    const output = pathFieldPlugin({
      collections: { pages: true },
      resolveDocumentUrl: () => null,
    })(baseConfig()) as Config
    const hook = output.collections?.[0]?.hooks?.beforeChange?.at(-1)

    await expect(
      hook?.({
        collection: {} as never,
        context: {},
        data: { slug: 'not-ready' },
        operation: 'create',
        req: { locale: 'en', payload: {} } as never,
      }),
    ).resolves.toMatchObject({ path: null })
  })

  it('keeps unresolved documents from failing internal path rebuilds', async () => {
    const output = pathFieldPlugin({
      collections: { pages: true },
      resolveDocumentUrl: () => null,
    })(baseConfig()) as Config
    const hook = output.collections?.[0]?.hooks?.beforeChange?.at(-1)

    await expect(
      hook?.({
        collection: {} as never,
        context: { [PATH_REBUILD_CONTEXT_KEY]: true },
        data: {},
        operation: 'update',
        originalDoc: { id: 1, slug: 'not-ready' },
        req: { locale: 'en', payload: {} } as never,
      }),
    ).resolves.toMatchObject({ path: null })
  })

  it.each([
    ['an empty path', ''],
    ['no path yet', null],
    ['an absolute URL', 'https://example.com'],
  ])('fails writes when the resolver returns %s', async (_label, resolvedPath) => {
    const output = pathFieldPlugin({
      collections: { pages: true },
      resolveDocumentUrl: () => resolvedPath,
    })(baseConfig()) as Config
    const hook = output.collections?.[0]?.hooks?.beforeChange?.at(-1)

    const write = hook?.({
        collection: {} as never,
        context: {},
        data: { slug: 'bad' },
        operation: resolvedPath === null ? 'update' : 'create',
        req: { locale: 'en', payload: {} } as never,
      })

    await expect(write).rejects.toBeInstanceOf(ValidationError)
    await expect(write).rejects.toMatchObject({
      data: {
        collection: 'pages',
        errors: [{ path: 'path' }],
      },
      status: 400,
    })
  })
})

describe('path utilities', () => {
  it('strictly validates document paths', () => {
    expect(isValidDocumentPath('/')).toBe(true)
    expect(isValidDocumentPath('/products/shoes/')).toBe(true)
    for (const path of [
      '',
      'relative',
      '//example.com/path',
      '/path?query=1',
      '/path#fragment',
      '/path\\child',
      '/https://example.com',
      '/path\u0000child',
    ]) {
      expect(validateDocumentPath(path)).not.toBe(true)
    }
  })

  it('cleans and joins path segments', () => {
    expect(cleanPathSegment(' /hello world/ ')).toBe('hello-world')
    expect(joinPathSegments('/uk/', 'category', 'shoes')).toBe(
      '/uk/category/shoes',
    )
    expect(joinPathSegments()).toBe('/')
  })
})

describe('pagination paths', () => {
  it('builds page one and higher pages with trailing-slash preservation', () => {
    expect(buildPaginatedPath('/products', 1)).toBe('/products')
    expect(buildPaginatedPath('/products', 2)).toBe('/products/page/2')
    expect(buildPaginatedPath('/products/', 2)).toBe('/products/page/2/')
    expect(buildPaginatedPath('/', 3)).toBe('/page/3')
  })

  it('parses canonical pages and canonicalizes page one', () => {
    expect(parsePaginatedPath('/products/page/2')).toEqual({
      basePath: '/products',
      canonicalPath: '/products/page/2',
      isCanonical: true,
      page: 2,
    })
    expect(parsePaginatedPath('/products/page/1')).toEqual({
      basePath: '/products',
      canonicalPath: '/products',
      isCanonical: false,
      page: 1,
    })
    expect(parsePaginatedPath('/products/page/2/')).toEqual({
      basePath: '/products/',
      canonicalPath: '/products/page/2/',
      isCanonical: true,
      page: 2,
    })
  })

  it('rejects malformed and non-canonical page numbers', () => {
    for (const path of [
      '/products/page/0',
      '/products/page/-1',
      '/products/page/1.5',
      '/products/page/003',
      '/products/page/%32',
      `/products/page/${Number.MAX_SAFE_INTEGER + 1}`,
    ]) {
      expect(parsePaginatedPath(path)).toBeNull()
    }
    expect(() => buildPaginatedPath('/products', 0)).toThrow(
      /positive safe integer/,
    )
  })
})
