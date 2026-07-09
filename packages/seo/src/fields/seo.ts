import type { Field, GroupField, TextField } from 'payload'

import {
  SEO_PLUGIN_MARKER,
  SEO_PREVIEWS_ADMIN_COMPONENT,
  SEO_RAW_JSON_ADMIN_COMPONENT,
  SEO_SCHEMA_VALUE_OVERRIDES_ADMIN_COMPONENT,
  type SeoCollectionConfig,
} from '../types.js'
import { validateAbsoluteHttpUrl, validateJson } from '../utils/validation.js'

const localized = true
const socialCards = [
  { label: 'Summary', value: 'summary' },
  { label: 'Summary large image', value: 'summary_large_image' },
]

const visualFieldTypes = new Set(['text', 'textarea', 'number', 'checkbox', 'select', 'date', 'upload'])

const schemaTypeIs = (seoField: string, data: unknown, ...types: string[]): boolean => {
  if (!data || typeof data !== 'object') return false
  const seo = (data as Record<string, unknown>)[seoField]
  if (!seo || typeof seo !== 'object') return false
  const schema = (seo as Record<string, unknown>).schema
  return Boolean(schema && typeof schema === 'object' && types.includes((schema as Record<string, unknown>).type as string))
}

const createBuiltInVisualFields = (seoField: string): Field[] => {
  const when = (...types: string[]) => (data: unknown) => schemaTypeIs(seoField, data, ...types)
  return [
    { name: 'name', type: 'text', label: 'Name', admin: { condition: when('WebPage', 'Product', 'Organization', 'LocalBusiness') } },
    { name: 'about', type: 'textarea', label: 'About', admin: { condition: when('WebPage') } },
    { name: 'headline', type: 'text', label: 'Headline', admin: { condition: when('Article') } },
    { name: 'author', type: 'text', label: 'Author', admin: { condition: when('Article') } },
    { name: 'datePublished', type: 'date', label: 'Published date', admin: { condition: when('Article') } },
    { name: 'dateModified', type: 'date', label: 'Modified date', admin: { condition: when('Article') } },
    { name: 'description', type: 'textarea', label: 'Product description', admin: { condition: when('Product') } },
    { name: 'sku', type: 'text', label: 'SKU', admin: { condition: when('Product') } },
    { name: 'brand', type: 'text', label: 'Brand', admin: { condition: when('Product') } },
    { name: 'price', type: 'number', label: 'Price', admin: { condition: when('Product') } },
    { name: 'priceCurrency', type: 'text', label: 'Price currency', admin: { condition: when('Product') } },
    { name: 'telephone', type: 'text', label: 'Telephone', admin: { condition: when('LocalBusiness') } },
    { name: 'address', type: 'textarea', label: 'Address', admin: { condition: when('LocalBusiness') } },
    { name: 'question', type: 'text', label: 'Question', admin: { condition: when('FAQPage') } },
    { name: 'answer', type: 'textarea', label: 'Answer', admin: { condition: when('FAQPage') } },
  ]
}

export const isSupportedVisualField = (field: Field): boolean =>
  'name' in field && visualFieldTypes.has(field.type)

const schemaOptions = [
  'WebPage',
  'Article',
  'Product',
  'Organization',
  'LocalBusiness',
  'FAQPage',
].map((value) => ({ label: value, value }))

const uploadField = (name: string, relationTo: string): Field => ({
  name,
  type: 'upload',
  relationTo,
  localized,
})

/** Creates the localized, marked SEO group attached to each enabled document. */
export const createSeoField = ({
  collection,
  mediaCollection,
  name,
}: {
  collection: SeoCollectionConfig
  mediaCollection: string
  name: string
}): GroupField => {
  const imageCollection = collection.media?.collection ?? mediaCollection
  const customVisualFields = (collection.visualFields ?? []).map((field) => ({ ...field, localized }) as Field)
  const visualFields = [...createBuiltInVisualFields(name), ...customVisualFields]
    .reduce<Field[]>((fields, field) => {
      const fieldName = 'name' in field ? field.name : undefined
      const index = fieldName ? fields.findIndex((candidate) => 'name' in candidate && candidate.name === fieldName) : -1
      if (index >= 0) fields[index] = field
      else fields.push(field)
      return fields
    }, [])
    .map((field) => ({ ...field, localized }) as Field)

  return {
    name,
    type: 'group',
    label: 'SEO',
    ...(collection.access ? { access: collection.access } : {}),
    admin: { custom: { seo: { marker: SEO_PLUGIN_MARKER } } },
    fields: [
      {
        type: 'tabs',
        tabs: [
          {
            label: 'General',
            fields: [
              { name: 'title', type: 'text', localized },
              { name: 'description', type: 'textarea', localized },
              { name: 'focusKeyword', type: 'text', localized },
            ],
          },
          {
            label: 'Canonical',
            fields: [{
              name: 'canonical', type: 'group', fields: [
                { name: 'mode', type: 'select', localized, defaultValue: 'auto', required: true, options: ['auto', 'manual', 'none'] },
                {
                  name: 'url', type: 'text', localized, validate: (value, { siblingData } = {} as never) =>
                    (siblingData as { mode?: string } | undefined)?.mode === 'manual' && !value
                      ? 'A manual canonical URL is required.'
                      : validateAbsoluteHttpUrl(value),
                  admin: { condition: (_, siblingData) => siblingData?.mode === 'manual' },
                } as TextField,
              ],
            }],
          },
          {
            label: 'Robots',
            fields: [{
              name: 'robots', type: 'group', fields: [
                { name: 'index', type: 'select', localized, defaultValue: 'index', required: true, options: ['index', 'noindex'] },
                { name: 'follow', type: 'select', localized, defaultValue: 'follow', required: true, options: ['follow', 'nofollow'] },
              ],
            }],
          },
          {
            label: 'Open Graph',
            fields: [{
              name: 'openGraph', type: 'group', fields: [
                { name: 'title', type: 'text', localized },
                { name: 'description', type: 'textarea', localized },
                uploadField('image', imageCollection),
              ],
            }],
          },
          {
            label: 'X / Twitter',
            fields: [{
              name: 'twitter', type: 'group', fields: [
                { name: 'title', type: 'text', localized },
                { name: 'description', type: 'textarea', localized },
                uploadField('image', imageCollection),
                { name: 'card', type: 'select', localized, options: socialCards },
              ],
            }],
          },
          {
            label: 'Schema',
            fields: [{
              name: 'schema', type: 'group', fields: [
                { name: 'type', type: 'select', localized, defaultValue: collection.schemaType, required: true, options: schemaOptions },
                {
                  name: 'values', type: 'group', label: 'Schema overrides', localized, fields: visualFields,
                  admin: {
                    components: { Field: SEO_SCHEMA_VALUE_OVERRIDES_ADMIN_COMPONENT },
                    custom: { seo: { schemaMappings: collection.schema ?? {} } },
                  },
                },
                {
                  name: 'rawJson', type: 'textarea', localized, validate: validateJson,
                  admin: {
                    components: { Field: SEO_RAW_JSON_ADMIN_COMPONENT },
                    custom: {
                      seo: {
                        collectionSchema: collection.schema ?? {},
                        defaultType: collection.schemaType,
                        marker: SEO_PLUGIN_MARKER,
                        seoField: name,
                      },
                    },
                  },
                },
              ],
            }],
          },
          {
            label: 'Previews',
            fields: [{
              name: 'previews',
              type: 'ui',
              admin: {
                components: { Field: SEO_PREVIEWS_ADMIN_COMPONENT },
                custom: { seo: { seoField: name } },
              },
            }],
          },
        ],
      },
    ],
  }
}
