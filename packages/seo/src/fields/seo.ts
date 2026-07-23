import type { GroupField, TextField } from 'payload'

import { SEO_DOCUMENT_SCHEMA_MANAGER_ADMIN_COMPONENT, SEO_PLUGIN_MARKER, SEO_PREVIEWS_ADMIN_COMPONENT, type SeoCollectionConfig } from '../types.js'
import type { JsonObject, SeoSchemaVariable } from '../schema/types.js'
import { adminLabel, adminTabLabel, adminText } from '../admin/translations.js'
import { validateCanonicalUrl } from '../utils/validation.js'
import { validateJsonPatch, validateSchemaObject } from '../schema/json.js'

const localized = true
const socialCards = [
  { label: adminLabel('summary'), value: 'summary' },
  { label: adminLabel('summaryLargeImage'), value: 'summary_large_image' },
]

const uploadField = (name: string, relationTo: string) => ({ name, type: 'upload' as const, label: adminLabel('image'), relationTo, localized })

export const createSeoField = ({ collection, collectionSlug, mediaCollection, name, trailingSlashPolicy, schemaVariables = [] }: {
  collection: SeoCollectionConfig
  collectionSlug: string
  mediaCollection: string
  name: string
  trailingSlashPolicy?: 'always' | 'never'
  schemaVariables?: SeoSchemaVariable[]
}): GroupField => {
  const imageCollection = collection.media?.collection ?? mediaCollection
  return {
    name,
    type: 'group',
    label: adminLabel('seo'),
    ...(collection.access ? { access: collection.access } : {}),
    admin: { custom: { seo: { marker: SEO_PLUGIN_MARKER } } },
    fields: [{
      type: 'tabs',
      tabs: [
        { label: adminTabLabel('general'), fields: [
          { name: 'title', type: 'text', label: adminLabel('title'), localized },
          { name: 'description', type: 'textarea', label: adminLabel('description'), localized },
          { name: 'focusKeyword', type: 'text', label: adminLabel('focusKeyword'), localized, admin: { description: adminTabLabel('keywordsDescription') } },
          { name: 'overrideKeywords', type: 'checkbox', label: adminLabel('override'), localized, defaultValue: false },
        ] },
        { label: adminTabLabel('canonical'), fields: [{ name: 'canonical', type: 'group', label: adminLabel('canonical'), fields: [
          { name: 'mode', type: 'select', label: adminLabel('canonicalMode'), localized, defaultValue: 'auto', required: true, options: [{ label: adminLabel('auto'), value: 'auto' }, { label: adminLabel('manual'), value: 'manual' }, { label: adminLabel('none'), value: 'none' }] },
          { name: 'url', type: 'text', label: adminLabel('canonicalUrl'), localized, validate: (value, { siblingData, req } = {} as never) =>
            (siblingData as { mode?: string } | undefined)?.mode === 'manual' && !value ? adminText('validationManualCanonical', req?.i18n?.language) : validateCanonicalUrl(value, { req }, trailingSlashPolicy),
            admin: { condition: (_, siblingData) => siblingData?.mode === 'manual' } } as TextField,
        ] }] },
        { label: adminTabLabel('robots'), fields: [{ name: 'robots', type: 'group', label: adminLabel('robots'), fields: [
          { name: 'mode', type: 'select', label: adminLabel('robotsMode'), localized, defaultValue: 'inherit', required: true, options: [
            { label: 'Inherit', value: 'inherit' }, { label: 'Index, follow', value: 'index-follow' }, { label: 'No index, follow', value: 'noindex-follow' },
            { label: 'Index, nofollow', value: 'index-nofollow' }, { label: 'No index, nofollow', value: 'noindex-nofollow' }, { label: 'Custom directives', value: 'custom' },
          ] },
          { name: 'directives', type: 'text', label: adminLabel('robots'), localized, admin: { condition: (_, siblingData) => siblingData?.mode === 'custom' } },
        ] }] },
        { label: adminTabLabel('openGraph'), fields: [{ name: 'openGraph', type: 'group', label: adminLabel('openGraph'), fields: [
          { name: 'title', type: 'text', label: adminLabel('title'), localized }, { name: 'description', type: 'textarea', label: adminLabel('description'), localized }, uploadField('image', imageCollection),
        ] }] },
        { label: adminTabLabel('twitter'), fields: [{ name: 'twitter', type: 'group', label: adminLabel('twitter'), fields: [
          { name: 'title', type: 'text', label: adminLabel('title'), localized }, { name: 'description', type: 'textarea', label: adminLabel('description'), localized }, uploadField('image', imageCollection),
          { name: 'card', type: 'select', label: adminLabel('card'), localized, options: socialCards }, { name: 'site', type: 'text', label: adminLabel('twitter'), localized }, { name: 'creator', type: 'text', label: adminLabel('author'), localized },
        ] }] },
        { label: adminTabLabel('schema'), fields: [
          { name: 'documentSchemas', type: 'array', label: adminLabel('documentSchemas'), admin: { hidden: true }, fields: [
            { name: 'schemaId', type: 'text', required: true, admin: { hidden: true } },
            { name: 'name', type: 'text', required: true, admin: { hidden: true } },
            { name: 'schema', type: 'json', required: true, defaultValue: {}, admin: { hidden: true }, validate: (value, { req } = {} as never) => {
              const result = validateSchemaObject(value)
              return result === true ? true : adminText(result.includes('@context') ? 'validationSchemaContext' : 'validationSchemaRoot', req?.i18n?.language)
            } },
            { name: 'valueOverrides', type: 'json', localized, admin: { hidden: true }, validate: (value, { req, siblingData } = {} as never) => validateJsonPatch(value, { scalarValuesOnly: true, source: (siblingData as Record<string, unknown> | undefined)?.schema as JsonObject | undefined }) === true ? true : adminText('validationSchemaPatch', req?.i18n?.language) },
          ] },
          { name: 'schemaInstances', type: 'array', label: adminLabel('schema'), admin: { hidden: true }, fields: [
            { name: 'templateId', type: 'text', required: true, admin: { hidden: true } },
            { name: 'overrides', type: 'json', localized, admin: { hidden: true }, validate: (value, { req } = {} as never) => validateJsonPatch(value, { scalarValuesOnly: true }) === true ? true : adminText('validationSchemaPatch', req?.i18n?.language) },
          ] },
          { name: 'globalSchemaOverrides', type: 'array', label: adminLabel('schemaOverrides'), admin: { hidden: true }, fields: [
            { name: 'schemaId', type: 'text', required: true, admin: { hidden: true } },
            { name: 'overrides', type: 'json', localized, admin: { hidden: true }, validate: (value, { req } = {} as never) => validateJsonPatch(value, { scalarValuesOnly: true }) === true ? true : adminText('validationSchemaPatch', req?.i18n?.language) },
          ] },
          { name: 'schemaManager', type: 'ui', admin: { components: { Field: SEO_DOCUMENT_SCHEMA_MANAGER_ADMIN_COMPONENT }, custom: { seo: { mode: 'document', collection: collectionSlug, collectionVariables: { [collectionSlug]: schemaVariables } } } } },
        ] },
        { label: adminTabLabel('previews'), fields: [{ name: 'previews', type: 'ui', admin: { components: { Field: SEO_PREVIEWS_ADMIN_COMPONENT }, custom: { seo: { seoField: name } } } }] },
      ],
    }],
  }
}
