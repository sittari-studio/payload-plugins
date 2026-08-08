import type { Config, Field, GroupField, RelationshipField, TextField } from 'payload'
import { createHeadlessEditor } from '@payloadcms/richtext-lexical/lexical/headless'
import { describe, expect, it, vi } from 'vitest'

import { createResolveUrlHook } from '../src/hooks/resolveUrl.js'
import {
  LinkFieldAutoLinkNode,
  LinkFieldNode,
  linkField,
  linkFieldPlugin,
} from '../src/index.js'
import { LINK_FIELD_MARKER, LINK_FIELD_RUNTIME_CONFIG_KEY } from '../src/types.js'
import { getReferenceDocumentUrl } from '../src/utils/getReferenceDocumentUrl.js'
import { getReferenceIdentity } from '../src/utils/getReferenceIdentity.js'
import {
  getReferenceSummary,
  hasReferenceTitle,
} from '../src/utils/getReferenceSummary.js'
import { validateUrl } from '../src/utils/validateUrl.js'

const getChildField = <TField extends Field>(field: GroupField, name: string): TField => {
  const childField = field.fields.find((candidate) => 'name' in candidate && candidate.name === name)

  if (!childField) {
    throw new Error(`Missing child field ${name}`)
  }

  return childField as TField
}

const applyPlugin = (config: Config, resolver = vi.fn(() => '/resolved')) =>
  linkFieldPlugin({
    resolveDocumentUrl: resolver,
  })(config) as Config

describe('linkField', () => {
  it('builds the default group field shape', () => {
    const field = linkField({
      name: 'link',
    })

    expect(field.type).toBe('group')
    expect((field as { name: string }).name).toBe('link')
    expect(field.admin?.components?.Field).toBe('@sittari/payload-link-field/client#LinkField')
    expect(field.admin?.custom?.linkField).toMatchObject({
      appearance: 'drawer',
      marker: LINK_FIELD_MARKER,
      showLabel: true,
      showNewTab: true,
    })
    expect(getChildField(field, 'type')).toMatchObject({
      defaultValue: 'custom',
      type: 'radio',
    })
    expect(getChildField(field, 'label')).toMatchObject({
      type: 'text',
    })
    expect(getChildField(field, 'newTab')).toMatchObject({
      type: 'checkbox',
    })
    expect(getChildField<RelationshipField>(field, 'reference')).toMatchObject({
      admin: {
        components: {
          Field: '@sittari/payload-link-field/client#ReadableRelationshipField',
        },
      },
    })
    expect(getChildField<TextField>(field, 'url')).toMatchObject({
      admin: {
        hidden: true,
      },
      type: 'text',
      virtual: true,
    })
    expect(getChildField<TextField>(field, 'url').hidden).toBeUndefined()
  })

  it('honors explicit field options', () => {
    const field = linkField({
      appearance: 'inline',
      defaultType: 'reference',
      name: 'cta',
      relationTo: ['pages', 'posts'],
      showLabel: false,
      showNewTab: false,
    })

    expect(field.admin?.custom?.linkField).toMatchObject({
      appearance: 'inline',
      showLabel: false,
      showNewTab: false,
    })
    expect(getChildField(field, 'type')).toMatchObject({
      defaultValue: 'reference',
    })
    expect(field.fields.some((child) => 'name' in child && child.name === 'label')).toBe(false)
    expect(field.fields.some((child) => 'name' in child && child.name === 'newTab')).toBe(false)
    expect(getChildField<RelationshipField>(field, 'reference').relationTo).toEqual([
      'pages',
      'posts',
    ])
  })

  it('validates only the active required field', () => {
    const field = linkField({
      name: 'link',
      required: true,
    })
    const customUrl = getChildField<TextField>(field, 'customUrl')
    const reference = getChildField<RelationshipField>(field, 'reference')

    expect((customUrl.validate as any)?.('', { siblingData: { type: 'custom' } })).toBe(
      'URL is required.',
    )
    expect((customUrl.validate as any)?.('', { siblingData: { type: 'reference' } })).toBe(true)
    expect((reference.validate as any)?.('', { siblingData: { type: 'reference' } })).toBe(
      'Document reference is required.',
    )
    expect((reference.validate as any)?.('', { siblingData: { type: 'custom' } })).toBe(true)
  })

  it('rejects references to the current document', () => {
    const singleRelationField = linkField({
      name: 'singleLink',
      relationTo: 'pages',
    })
    const polymorphicField = linkField({
      name: 'polymorphicLink',
      relationTo: ['pages', 'posts'],
    })
    const singleReference = getChildField<RelationshipField>(singleRelationField, 'reference')
    const polymorphicReference = getChildField<RelationshipField>(polymorphicField, 'reference')
    const options = {
      collectionSlug: 'pages',
      id: 5,
      siblingData: { type: 'reference' },
    }

    expect((singleReference.validate as any)?.(5, options)).toBe(
      'A link cannot reference the current document.',
    )
    expect(
      (polymorphicReference.validate as any)?.(
        { relationTo: 'pages', value: { id: '5' } },
        options,
      ),
    ).toBe('A link cannot reference the current document.')
    expect(
      (polymorphicReference.validate as any)?.(
        { relationTo: 'posts', value: 5 },
        options,
      ),
    ).toBe(true)
    expect((singleReference.validate as any)?.(5, { ...options, siblingData: { type: 'custom' } }))
      .toBe(true)
  })
})

describe('linkFieldPlugin', () => {
  it('resolves empty relationTo to all collection slugs and attaches the url hook', () => {
    const field = linkField({ name: 'link' })
    const outputConfig = applyPlugin({
      collections: [
        {
          slug: 'pages',
          fields: [field],
        },
        {
          slug: 'posts',
          fields: [],
        },
      ],
    } as Config)
    const link = outputConfig.collections?.[0]?.fields[0] as GroupField

    expect(getChildField<RelationshipField>(link, 'reference').relationTo).toEqual([
      'pages',
      'posts',
    ])
    expect(link.admin?.custom?.linkField).toMatchObject({
      apiRoute: '/api',
      collections: {
        pages: {
          label: 'pages',
        },
        posts: {
          label: 'posts',
        },
      },
    })
    expect(getChildField<TextField>(link, 'url').hooks?.afterRead).toHaveLength(1)
    expect(outputConfig.custom?.[LINK_FIELD_RUNTIME_CONFIG_KEY]).toMatchObject({
      resolveDocumentUrl: expect.any(Function),
    })
  })

  it('filters the current document from same-collection reference options', async () => {
    const outputConfig = applyPlugin({
      collections: [
        {
          slug: 'pages',
          fields: [linkField({ name: 'link' })],
        },
        {
          slug: 'posts',
          fields: [],
        },
      ],
    } as Config)
    const link = outputConfig.collections?.[0]?.fields[0] as GroupField
    const reference = getChildField<RelationshipField>(link, 'reference')

    await expect(
      (reference.filterOptions as any)?.({
        id: 5,
        relationTo: 'pages',
      }),
    ).resolves.toEqual({
      id: {
        not_equals: 5,
      },
    })
    await expect(
      (reference.filterOptions as any)?.({
        id: 5,
        relationTo: 'posts',
      }),
    ).resolves.toBe(true)
  })

  it('passes collection labels and title fields to the admin component', () => {
    const outputConfig = applyPlugin({
      collections: [
        {
          slug: 'pages',
          admin: {
            useAsTitle: 'headline',
          },
          fields: [linkField({ name: 'link' })],
          labels: {
            plural: 'Pages',
            singular: 'Page',
          },
        },
        {
          slug: 'posts',
          fields: [],
          labels: {
            plural: 'Posts',
            singular: 'Post',
          },
          useAsSlug: 'slug',
        } as never,
      ],
      routes: {
        api: '/payload-api',
      },
    } as Config)
    const link = outputConfig.collections?.[0]?.fields[0] as GroupField

    expect(link.admin?.custom?.linkField).toMatchObject({
      apiRoute: '/payload-api',
      collections: {
        pages: {
          label: 'Page',
          useAsTitle: 'headline',
        },
        posts: {
          label: 'Post',
          useAsTitle: 'slug',
        },
      },
    })
  })

  it('preserves localized singular labels for the reference summary', () => {
    const outputConfig = applyPlugin({
      collections: [
        {
          slug: 'pages',
          admin: {
            useAsTitle: 'title',
          },
          fields: [linkField({ name: 'link' })],
          labels: {
            plural: {
              en: 'Pages',
              uk: 'Сторінки',
            },
            singular: {
              en: 'Page',
              uk: 'Сторінка',
            },
          },
        },
      ],
    } as unknown as Config)
    const link = outputConfig.collections?.[0]?.fields[0] as GroupField

    expect(link.admin?.custom?.linkField).toMatchObject({
      collections: {
        pages: {
          label: {
            en: 'Page',
            uk: 'Сторінка',
          },
          useAsTitle: 'title',
        },
      },
    })
  })

  it('preserves explicit relationTo, field options, and user hooks', () => {
    const existingHook = vi.fn()
    const field = linkField({
      name: 'link',
      relationTo: ['pages'],
    })
    const url = getChildField<TextField>(field, 'url')
    url.hooks = {
      afterRead: [existingHook],
    }
    field.admin = {
      ...field.admin,
      description: 'Pick a link',
    }

    const outputConfig = applyPlugin({
      collections: [
        {
          slug: 'pages',
          fields: [field],
        },
        {
          slug: 'posts',
          fields: [],
        },
      ],
    } as Config)
    const link = outputConfig.collections?.[0]?.fields[0] as GroupField

    expect(link.admin?.description).toBe('Pick a link')
    expect(getChildField<RelationshipField>(link, 'reference').relationTo).toEqual(['pages'])
    expect(getChildField<TextField>(link, 'url').hooks?.afterRead?.[0]).toBe(existingHook)
    expect(getChildField<TextField>(link, 'url').hooks?.afterRead).toHaveLength(2)
  })

  it('walks collections, globals, arrays, blocks, groups, and tabs', () => {
    const outputConfig = applyPlugin({
      collections: [
        {
          slug: 'pages',
          fields: [
            {
              name: 'items',
              type: 'array',
              fields: [linkField({ name: 'arrayLink' })],
            },
            {
              name: 'layout',
              type: 'blocks',
              blocks: [
                {
                  slug: 'hero',
                  fields: [linkField({ name: 'blockLink' })],
                },
              ],
            },
            {
              type: 'tabs',
              tabs: [
                {
                  label: 'Links',
                  fields: [linkField({ name: 'tabLink' })],
                },
              ],
            },
          ],
        },
      ],
      globals: [
        {
          slug: 'settings',
          fields: [
            {
              name: 'footer',
              type: 'group',
              fields: [linkField({ name: 'globalLink' })],
            },
          ],
        },
      ],
    } as Config)
    const arrayField = outputConfig.collections?.[0]?.fields[0] as Field & { fields: Field[] }
    const blockField = outputConfig.collections?.[0]?.fields[1] as Field & {
      blocks: Array<{ fields: Field[] }>
    }
    const tabsField = outputConfig.collections?.[0]?.fields[2] as Field & {
      tabs: Array<{ fields: Field[] }>
    }
    const groupField = outputConfig.globals?.[0]?.fields[0] as Field & { fields: Field[] }

    expect(getChildField<TextField>(arrayField.fields[0] as GroupField, 'url').hooks?.afterRead).toHaveLength(
      1,
    )
    expect(
      getChildField<TextField>(blockField.blocks[0].fields[0] as GroupField, 'url').hooks
        ?.afterRead,
    ).toHaveLength(1)
    expect(
      getChildField<TextField>(tabsField.tabs[0].fields[0] as GroupField, 'url').hooks?.afterRead,
    ).toHaveLength(1)
    expect(
      getChildField<TextField>(groupField.fields[0] as GroupField, 'url').hooks?.afterRead,
    ).toHaveLength(1)
  })

  it('transforms reusable top-level blocks once without assigning collection ownership', () => {
    const reusableBlock = {
      slug: 'reusableLink',
      admin: {
        group: 'Reusable',
      },
      custom: {
        preserved: true,
      },
      fields: [linkField({ name: 'reusableLink' })],
    } as const
    const inlineBlock = {
      slug: 'inlineLink',
      fields: [linkField({ name: 'inlineLink' })],
    } as const
    const inputConfig = {
      blocks: [reusableBlock],
      collections: [
        {
          slug: 'pages',
          fields: [
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
    } as unknown as Config

    const outputConfig = applyPlugin(inputConfig)
    const outputReusableBlock = outputConfig.blocks?.[0]
    const referencedLayout = outputConfig.collections?.[0]?.fields[0]
    const inlineLayout = outputConfig.collections?.[0]?.fields[1]

    if (
      !outputReusableBlock ||
      !referencedLayout ||
      referencedLayout.type !== 'blocks' ||
      !inlineLayout ||
      inlineLayout.type !== 'blocks'
    ) {
      throw new Error('Expected reusable and inline blocks')
    }

    const reusableLink = outputReusableBlock.fields[0] as GroupField
    const inlineLink = inlineLayout.blocks[0].fields[0] as GroupField
    const reusableReference = getChildField<RelationshipField>(reusableLink, 'reference')

    expect(outputReusableBlock).toMatchObject({
      admin: {
        group: 'Reusable',
      },
      custom: {
        preserved: true,
      },
      slug: 'reusableLink',
    })
    expect(referencedLayout.blockReferences).toEqual(['reusableLink'])
    expect(getChildField<TextField>(reusableLink, 'url').hooks?.afterRead).toHaveLength(1)
    expect(getChildField<TextField>(inlineLink, 'url').hooks?.afterRead).toHaveLength(1)
    expect(reusableReference.filterOptions).toBeUndefined()

    expect(inputConfig.blocks?.[0]).toBe(reusableBlock)
    expect(inputConfig.blocks?.[0]?.fields[0]).toBe(reusableBlock.fields[0])
    expect(
      getChildField<TextField>(reusableBlock.fields[0], 'url').hooks?.afterRead,
    ).toBeUndefined()
  })
})

describe('Lexical link nodes', () => {
  it('imports Payload-native custom nodes and exports only the plugin-owned shape', () => {
    const editor = createHeadlessEditor({ nodes: [LinkFieldNode, LinkFieldAutoLinkNode] })
    const state = editor.parseEditorState({
      root: {
        children: [{
          children: [{
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: 'Read more',
            type: 'text',
            version: 1,
          }],
          direction: null,
          fields: {
            linkType: 'custom',
            newTab: true,
            url: '/about',
          },
          format: '',
          indent: 0,
          type: 'link',
          version: 3,
        }],
        direction: null,
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
      },
    } as never)

    const node = (state.toJSON().root.children[0] as any)
    expect(node.fields).toEqual({
      customUrl: '/about',
      label: 'Read more',
      newTab: true,
      type: 'custom',
      url: '/about',
    })
    expect(node.version).toBe(1)
  })

  it('imports Payload-native internal nodes as references', () => {
    const editor = createHeadlessEditor({ nodes: [LinkFieldNode, LinkFieldAutoLinkNode] })
    const state = editor.parseEditorState({
      root: {
        children: [{
          children: [{
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: 'Post',
            type: 'text',
            version: 1,
          }],
          direction: null,
          fields: {
            doc: { relationTo: 'posts', value: 'post-1' },
            linkType: 'internal',
          },
          format: '',
          indent: 0,
          type: 'link',
          version: 3,
        }],
        direction: null,
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
      },
    } as never)

    expect((state.toJSON().root.children[0] as any).fields).toMatchObject({
      label: 'Post',
      reference: { relationTo: 'posts', value: 'post-1' },
      type: 'reference',
    })
  })
})

describe('validateUrl', () => {
  it('allows safe custom URL forms', () => {
    expect(validateUrl('/about')).toBe(true)
    expect(validateUrl('../about')).toBe(true)
    expect(validateUrl('#section')).toBe(true)
    expect(validateUrl('?modal=true')).toBe(true)
    expect(validateUrl('https://example.com')).toBe(true)
    expect(validateUrl('http://example.com')).toBe(true)
  })

  it('rejects unsafe protocols', () => {
    expect(validateUrl('javascript:alert(1)')).toBe('Only http and https URLs are allowed.')
    expect(validateUrl('data:text/html,hello')).toBe('Only http and https URLs are allowed.')
    expect(validateUrl('//example.com')).toBe('Protocol-relative URLs are not allowed.')
  })
})

describe('getReferenceIdentity', () => {
  it('supports single relationship IDs and documents', () => {
    expect(
      getReferenceIdentity({
        reference: '123',
        relationTo: 'pages',
      }),
    ).toEqual({
      collectionSlug: 'pages',
      document: null,
      documentId: '123',
    })
    expect(
      getReferenceIdentity({
        reference: { id: 123, title: 'Home' },
        relationTo: 'pages',
      }),
    ).toEqual({
      collectionSlug: 'pages',
      document: { id: 123, title: 'Home' },
      documentId: 123,
    })
  })

  it('supports polymorphic relationship IDs and documents', () => {
    expect(
      getReferenceIdentity({
        reference: {
          relationTo: 'posts',
          value: '456',
        },
      }),
    ).toEqual({
      collectionSlug: 'posts',
      document: null,
      documentId: '456',
    })
    expect(
      getReferenceIdentity({
        reference: {
          relationTo: 'posts',
          value: { id: '456', title: 'Post' },
        },
      }),
    ).toEqual({
      collectionSlug: 'posts',
      document: { id: '456', title: 'Post' },
      documentId: '456',
    })
  })
})

describe('getReferenceSummary', () => {
  it('formats populated references with collection label and configured title field', () => {
    expect(
      getReferenceSummary({
        collections: {
          pages: {
            label: 'Page',
            useAsTitle: 'headline',
          },
        },
        reference: {
          id: 'page-1',
          headline: 'Homepage',
          title: 'Ignored title',
        },
        relationTo: 'pages',
      }),
    ).toBe('Page: Homepage')
  })

  it('formats polymorphic ID references with collection label until the document is loaded', () => {
    expect(
      getReferenceSummary({
        collections: {
          posts: {
            label: 'Post',
            useAsTitle: 'slug',
          },
        },
        reference: {
          relationTo: 'posts',
          value: 'post-1',
        },
      }),
    ).toBe('Post: post-1')
  })

  it('uses the resolved document title for ID-only references', () => {
    expect(
      getReferenceSummary({
        collections: {
          posts: {
            label: 'Post',
            useAsTitle: 'slug',
          },
        },
        reference: {
          relationTo: 'posts',
          value: 'post-1',
        },
        resolvedDocument: {
          id: 'post-1',
          slug: 'hello-world',
        },
      }),
    ).toBe('Post: hello-world')
  })

  it('localizes the singular collection label', () => {
    expect(
      getReferenceSummary({
        collections: {
          pages: {
            label: {
              en: 'Page',
              uk: 'Сторінка',
            },
            useAsTitle: 'title',
          },
        },
        language: 'uk',
        reference: {
          id: 18,
          title: 'Детальніше про клініку',
        },
        relationTo: 'pages',
      }),
    ).toBe('Сторінка: Детальніше про клініку')
  })

  it('detects when an ID-only relationship needs its configured title loaded', () => {
    expect(hasReferenceTitle({ id: 18 }, 'title')).toBe(false)
    expect(hasReferenceTitle({ id: 18, title: 'About the clinic' }, 'title')).toBe(true)
    expect(hasReferenceTitle({ id: 18 }, undefined)).toBe(true)
  })
})

describe('getReferenceDocumentUrl', () => {
  it('requests the selected document in the active content locale', () => {
    expect(
      getReferenceDocumentUrl({
        apiRoute: '/api',
        collectionSlug: 'pages',
        documentId: 18,
        locale: 'uk',
      }),
    ).toBe('/api/pages/18?depth=0&locale=uk')
  })

  it('normalizes and encodes URL segments', () => {
    expect(
      getReferenceDocumentUrl({
        apiRoute: 'payload-api',
        collectionSlug: 'landing pages',
        documentId: 'page/1',
      }),
    ).toBe('/payload-api/landing%20pages/page%2F1?depth=0')
  })
})

describe('resolveUrl hook', () => {
  it('resolves custom URLs', async () => {
    const resolver = vi.fn()
    const hook = createResolveUrlHook(resolver)

    await expect(
      hook({
        siblingData: {
          customUrl: '/about',
          type: 'custom',
        },
      } as never),
    ).resolves.toBe('/about')
    expect(resolver).not.toHaveBeenCalled()
  })

  it('uses the plugin resolver for reference URLs', async () => {
    const resolver = vi.fn(() => '/posts/hello')
    const hook = createResolveUrlHook(resolver)
    const payload = {
      logger: {
        error: vi.fn(),
      },
    }
    const req = {
      fallbackLocale: 'en',
      locale: 'uk',
      payload,
    }

    await expect(
      hook({
        data: { id: 'doc' },
        originalDoc: { id: 'original' },
        path: ['hero', 'link', 'url'],
        req,
        siblingData: {
          reference: {
            relationTo: 'posts',
            value: { id: 'post-1', slug: 'hello' },
          },
          type: 'reference',
        },
        siblingFields: [
          {
            name: 'reference',
            relationTo: ['pages', 'posts'],
            type: 'relationship',
          },
        ],
      } as never),
    ).resolves.toBe('/posts/hello')
    expect(resolver).toHaveBeenCalledWith(
      expect.objectContaining({
        collectionSlug: 'posts',
        document: { id: 'post-1', slug: 'hello' },
        documentId: 'post-1',
        fallbackLocale: 'en',
        fieldPath: 'hero.link.url',
        locale: 'uk',
        originalDoc: { id: 'original' },
        payload,
        req,
      }),
    )
  })

  it('fetches unpopulated references and returns null on resolver errors', async () => {
    const resolver = vi.fn(() => {
      throw new Error('resolver failed')
    })
    const hook = createResolveUrlHook(resolver)
    const error = vi.fn()
    const findByID = vi.fn(() => ({ id: 'post-1', slug: 'hello' }))

    await expect(
      hook({
        path: ['link', 'url'],
        req: {
          payload: {
            findByID,
            logger: {
              error,
            },
          },
        },
        siblingData: {
          reference: {
            relationTo: 'posts',
            value: 'post-1',
          },
          type: 'reference',
        },
        siblingFields: [
          {
            name: 'reference',
            relationTo: ['pages', 'posts'],
            type: 'relationship',
          },
        ],
      } as never),
    ).resolves.toBeNull()
    expect(findByID).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'posts',
        depth: 0,
        disableErrors: true,
        id: 'post-1',
      }),
    )
    expect(error).toHaveBeenCalled()
  })
})
