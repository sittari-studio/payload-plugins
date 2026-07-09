import type { Field, GroupField, TextField } from 'payload'

import {
  SEO_PLUGIN_MARKER,
  SEO_PREVIEWS_ADMIN_COMPONENT,
  SEO_RAW_JSON_ADMIN_COMPONENT,
  SEO_SCHEMA_VALUE_OVERRIDES_ADMIN_COMPONENT,
  type SeoCollectionConfig,
} from '../types.js'
import { adminLabel, adminTabLabel, adminText } from '../admin/translations.js'
import { validateAbsoluteHttpUrl, validateJson } from '../utils/validation.js'

const localized = true
const socialCards = [
  { label: adminLabel('summary'), value: 'summary' },
  { label: adminLabel('summaryLargeImage'), value: 'summary_large_image' },
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
    { name: 'name', type: 'text', label: adminLabel('name'), admin: { condition: when('WebPage', 'Product', 'Organization', 'LocalBusiness') } },
    { name: 'about', type: 'textarea', label: adminLabel('about'), admin: { condition: when('WebPage') } },
    { name: 'headline', type: 'text', label: adminLabel('headline'), admin: { condition: when('Article') } },
    { name: 'author', type: 'text', label: adminLabel('author'), admin: { condition: when('Article') } },
    { name: 'datePublished', type: 'date', label: adminLabel('datePublished'), admin: { condition: when('Article') } },
    { name: 'dateModified', type: 'date', label: adminLabel('dateModified'), admin: { condition: when('Article') } },
    { name: 'description', type: 'textarea', label: adminLabel('productDescription'), admin: { condition: when('Product') } },
    { name: 'sku', type: 'text', label: adminLabel('sku'), admin: { condition: when('Product') } },
    { name: 'brand', type: 'text', label: adminLabel('brand'), admin: { condition: when('Product') } },
    { name: 'price', type: 'number', label: adminLabel('price'), admin: { condition: when('Product') } },
    { name: 'priceCurrency', type: 'text', label: adminLabel('priceCurrency'), admin: { condition: when('Product') } },
    { name: 'telephone', type: 'text', label: adminLabel('telephone'), admin: { condition: when('LocalBusiness') } },
    { name: 'address', type: 'textarea', label: adminLabel('address'), admin: { condition: when('LocalBusiness') } },
    { name: 'question', type: 'text', label: adminLabel('question'), admin: { condition: when('FAQPage') } },
    { name: 'answer', type: 'textarea', label: adminLabel('answer'), admin: { condition: when('FAQPage') } },
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
  label: adminLabel('image'),
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
    label: adminLabel('seo'),
    ...(collection.access ? { access: collection.access } : {}),
    admin: { custom: { seo: { marker: SEO_PLUGIN_MARKER } } },
    fields: [
      {
        type: 'tabs',
        tabs: [
          {
            label: adminTabLabel('general'),
            fields: [
              { name: 'title', type: 'text', label: adminLabel('title'), localized },
              { name: 'description', type: 'textarea', label: adminLabel('description'), localized },
              { name: 'focusKeyword', type: 'text', label: adminLabel('focusKeyword'), localized },
            ],
          },
          {
            label: adminTabLabel('canonical'),
            fields: [{
              name: 'canonical', type: 'group', label: adminLabel('canonical'), fields: [
                { name: 'mode', type: 'select', label: adminLabel('canonicalMode'), localized, defaultValue: 'auto', required: true, options: [{ label: adminLabel('auto'), value: 'auto' }, { label: adminLabel('manual'), value: 'manual' }, { label: adminLabel('none'), value: 'none' }] },
                {
                  name: 'url', type: 'text', label: adminLabel('canonicalUrl'), localized, validate: (value, { siblingData, req } = {} as never) =>
                    (siblingData as { mode?: string } | undefined)?.mode === 'manual' && !value
                      ? adminText('validationManualCanonical', req?.i18n?.language)
                      : validateAbsoluteHttpUrl(value, { req }),
                  admin: { condition: (_, siblingData) => siblingData?.mode === 'manual' },
                } as TextField,
              ],
            }],
          },
          {
            label: adminTabLabel('robots'),
            fields: [{
              name: 'robots', type: 'group', label: adminLabel('robots'), fields: [
                {
                  name: 'mode', type: 'select', label: adminLabel('robotsMode'), localized, defaultValue: 'inherit', required: true,
                  options: [
                    { label: 'Inherit', value: 'inherit' }, { label: 'Index, follow', value: 'index-follow' },
                    { label: 'No index, follow', value: 'noindex-follow' }, { label: 'Index, nofollow', value: 'index-nofollow' },
                    { label: 'No index, nofollow', value: 'noindex-nofollow' }, { label: 'Custom directives', value: 'custom' },
                  ],
                },
                { name: 'directives', type: 'text', label: adminLabel('robots'), localized, admin: { condition: (_, siblingData) => siblingData?.mode === 'custom' } },
              ],
            }],
          },
          {
            label: adminTabLabel('openGraph'),
            fields: [{
              name: 'openGraph', type: 'group', label: adminLabel('openGraph'), fields: [
                { name: 'title', type: 'text', label: adminLabel('title'), localized },
                { name: 'description', type: 'textarea', label: adminLabel('description'), localized },
                uploadField('image', imageCollection),
              ],
            }],
          },
          {
            label: adminTabLabel('twitter'),
            fields: [{
              name: 'twitter', type: 'group', label: adminLabel('twitter'), fields: [
                { name: 'title', type: 'text', label: adminLabel('title'), localized },
                { name: 'description', type: 'textarea', label: adminLabel('description'), localized },
                uploadField('image', imageCollection),
                { name: 'card', type: 'select', label: adminLabel('card'), localized, options: socialCards },
                { name: 'site', type: 'text', label: adminLabel('twitter'), localized },
                { name: 'creator', type: 'text', label: adminLabel('author'), localized },
              ],
            }],
          },
          {
            label: adminTabLabel('schema'),
            fields: [{
              name: 'schema', type: 'group', label: adminLabel('schema'), fields: [
                { name: 'type', type: 'select', label: adminLabel('schemaType'), localized, defaultValue: collection.schemaType, required: true, options: schemaOptions },
                {
                  name: 'values', type: 'group', label: adminLabel('schemaOverrides'), localized, fields: visualFields,
                  admin: {
                    components: { Field: SEO_SCHEMA_VALUE_OVERRIDES_ADMIN_COMPONENT },
                    custom: { seo: { schemaMappings: collection.schema ?? {} } },
                  },
                },
                {
                  name: 'rawJson', type: 'textarea', label: adminLabel('rawJson'), localized, validate: validateJson,
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
            label: adminTabLabel('previews'),
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
