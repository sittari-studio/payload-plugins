import type { Field, GroupField, TextField } from 'payload'

import { SEO_PLUGIN_MARKER, type SeoCollectionConfig } from '../types.js'
import { validateAbsoluteHttpUrl, validateJson } from '../utils/validation.js'

const localized = true
const socialCards = [
  { label: 'Summary', value: 'summary' },
  { label: 'Summary large image', value: 'summary_large_image' },
]

const visualFieldTypes = new Set(['text', 'textarea', 'number', 'checkbox', 'select', 'date', 'upload'])

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
  const visualFields = (collection.visualFields ?? []).map((field) => ({ ...field, localized }) as Field)

  return {
    name,
    type: 'group',
    label: 'SEO',
    ...(collection.access ? { access: collection.access } : {}),
    admin: {
      custom: {
        seo: { marker: SEO_PLUGIN_MARKER },
        component: '@krameri/payload-seo/admin/previews#SeoPreviews',
      },
    },
    fields: [
      { name: 'title', type: 'text', localized },
      { name: 'description', type: 'textarea', localized },
      { name: 'focusKeyword', type: 'text', localized },
      {
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
      },
      {
        name: 'robots', type: 'group', fields: [
          { name: 'index', type: 'select', localized, defaultValue: 'index', required: true, options: ['index', 'noindex'] },
          { name: 'follow', type: 'select', localized, defaultValue: 'follow', required: true, options: ['follow', 'nofollow'] },
        ],
      },
      {
        name: 'openGraph', type: 'group', fields: [
          { name: 'title', type: 'text', localized },
          { name: 'description', type: 'textarea', localized },
          uploadField('image', imageCollection),
        ],
      },
      {
        name: 'twitter', type: 'group', fields: [
          { name: 'title', type: 'text', localized },
          { name: 'description', type: 'textarea', localized },
          uploadField('image', imageCollection),
          { name: 'card', type: 'select', localized, options: socialCards },
        ],
      },
      {
        name: 'schema', type: 'group', fields: [
          { name: 'type', type: 'select', localized, defaultValue: collection.schemaType, required: true, options: schemaOptions },
          { name: 'values', type: 'group', localized, fields: visualFields },
          {
            name: 'rawJson', type: 'textarea', localized, validate: validateJson,
            admin: { custom: { seo: { marker: SEO_PLUGIN_MARKER }, component: '@krameri/payload-seo/admin/schema#ResetRawJson' } },
          },
        ],
      },
    ],
  }
}
