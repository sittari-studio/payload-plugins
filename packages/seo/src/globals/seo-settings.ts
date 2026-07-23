import type { GlobalBeforeChangeHook, GlobalConfig, Where } from 'payload'
import { randomUUID } from 'node:crypto'

import { SEO_PLUGIN_MARKER, SEO_SETTINGS_SCHEMA_MANAGER_ADMIN_COMPONENT, type SeoPluginAccess } from '../types.js'
import type { JsonObject, SeoSchemaVariable } from '../schema/types.js'
import { adminLabel, adminTabLabel, adminText } from '../admin/translations.js'
import { validateJsonPatch, validateSchemaObject } from '../schema/json.js'
import { validateRobotsToken } from '../utils/validation.js'

const schemaTemplateFields = (mode: 'collection' | 'global') => [
  { name: 'templateId', type: 'text' as const, required: true, defaultValue: () => randomUUID(), admin: { hidden: true } },
  { name: 'name', type: 'text' as const, required: true },
  {
    name: 'schema', type: 'json' as const, required: true, defaultValue: {}, validate: (value: unknown, { req }: { req?: { i18n?: { language?: string } } } = {}) => {
      const result = validateSchemaObject(value)
      return result === true ? true : adminText(result.includes('@context') ? 'validationSchemaContext' : 'validationSchemaRoot', req?.i18n?.language)
    },
    admin: { hidden: true },
  },
  { name: 'valueOverrides', type: 'json' as const, localized: true, admin: { hidden: true }, validate: (value: unknown, { req, siblingData }: { req?: { i18n?: { language?: string } }; siblingData?: Record<string, unknown> } = {}) => validateJsonPatch(value, { scalarValuesOnly: true, source: siblingData?.schema as JsonObject | undefined }) === true ? true : adminText('validationSchemaPatch', req?.i18n?.language) },
  ...(mode === 'collection' ? [{ name: 'isDefault', type: 'checkbox' as const, defaultValue: false }] : []),
]

const templateIdsByScope = (document: unknown): { collection: Set<string>; global: Set<string> } => {
  const output = { collection: new Set<string>(), global: new Set<string>() }
  if (!document || typeof document !== 'object') return output
  const record = document as Record<string, unknown>
  const collect = (items: unknown, target: Set<string>): void => {
    if (!Array.isArray(items)) return
    for (const template of items) if (template && typeof template === 'object') {
      const id = (template as Record<string, unknown>).templateId ?? (template as Record<string, unknown>).id
      if (typeof id === 'string') target.add(id)
    }
  }
  collect(record.globalSchemas, output.global)
  if (Array.isArray(record.collectionSchemas)) for (const group of record.collectionSchemas) {
    if (group && typeof group === 'object') collect((group as Record<string, unknown>).templates, output.collection)
  }
  return output
}

const allTemplateIds = (document: unknown): string[] => {
  if (!document || typeof document !== 'object') return []
  const record = document as Record<string, unknown>
  const ids: string[] = []
  const collect = (items: unknown): void => {
    if (!Array.isArray(items)) return
    for (const item of items) if (item && typeof item === 'object') {
      const id = (item as Record<string, unknown>).templateId
      if (typeof id === 'string' && id) ids.push(id)
    }
  }
  collect(record.globalSchemas)
  if (Array.isArray(record.collectionSchemas)) for (const group of record.collectionSchemas) {
    if (group && typeof group === 'object') collect((group as Record<string, unknown>).templates)
  }
  return ids
}

const enforceUniqueTemplateIds: GlobalBeforeChangeHook = ({ data }) => {
  const seen = new Set<string>()
  for (const id of allTemplateIds(data)) {
    if (seen.has(id)) throw new Error(`Schema template ID "${id}" must be unique across global and collection schemas.`)
    seen.add(id)
  }
  return data
}

const cascadeDeletedTemplates = (seoField: string, collections: string[]): GlobalBeforeChangeHook => async ({ data, originalDoc, req }) => {
  const previous = templateIdsByScope(originalDoc)
  const next = templateIdsByScope(data)
  const deletedCollection = new Set([...previous.collection].filter((id) => !next.collection.has(id)))
  const deletedGlobal = new Set([...previous.global].filter((id) => !next.global.has(id)))
  if (!deletedCollection.size && !deletedGlobal.size) return data

  for (const collection of collections) {
    const clauses: Where[] = []
    if (deletedCollection.size) clauses.push({ [`${seoField}.schemaInstances.templateId`]: { in: [...deletedCollection] } })
    if (deletedGlobal.size) clauses.push({ [`${seoField}.globalSchemaOverrides.schemaId`]: { in: [...deletedGlobal] } })
    const result = await req.payload.find({
      collection,
      where: clauses.length === 1 ? clauses[0] : { or: clauses },
      pagination: false,
      depth: 0,
      draft: true,
      trash: true,
      locale: req.locale,
      fallbackLocale: false,
      overrideAccess: true,
      req,
      select: { [seoField]: true, _status: true },
    })

    for (const document of result.docs) {
      const seo = document && typeof document === 'object' && (document as Record<string, unknown>)[seoField]
      const current = seo && typeof seo === 'object' && !Array.isArray(seo) ? seo as Record<string, unknown> : {}
      const schemaInstances = Array.isArray(current.schemaInstances)
        ? current.schemaInstances.filter((item) => !item || typeof item !== 'object' || !deletedCollection.has(String((item as Record<string, unknown>).templateId)))
        : []
      const globalSchemaOverrides = Array.isArray(current.globalSchemaOverrides)
        ? current.globalSchemaOverrides.filter((item) => !item || typeof item !== 'object' || !deletedGlobal.has(String((item as Record<string, unknown>).schemaId)))
        : []
      await req.payload.update({
        collection,
        id: document.id,
        data: { [seoField]: { schemaInstances, globalSchemaOverrides } },
        depth: 0,
        draft: (document as Record<string, unknown>)._status === 'draft',
        trash: true,
        locale: req.locale,
        fallbackLocale: false,
        overrideAccess: true,
        req,
      })
    }
  }
  return data
}

export const createSeoSettingsGlobal = ({ access, slug, mediaCollection, collectionVariables, defaultLocale, globalVariables, labeledCollections, seoField }: {
  access?: SeoPluginAccess['settings']; slug: string; mediaCollection: string; collectionVariables: Record<string, SeoSchemaVariable[]>; defaultLocale?: string; globalVariables: SeoSchemaVariable[]; labeledCollections: string[]; seoField: string
}): GlobalConfig => ({
  slug,
  label: adminLabel('seoSettings'),
  access: { read: access?.read ?? (() => false), update: access?.update ?? (() => false) },
  hooks: { beforeChange: [enforceUniqueTemplateIds, cascadeDeletedTemplates(seoField, Object.keys(collectionVariables))] },
  admin: { custom: { seo: { marker: SEO_PLUGIN_MARKER } }, group: 'SEO' },
  fields: [{ type: 'tabs', tabs: [
    { label: adminTabLabel('siteDefaults'), fields: [
      { name: 'siteName', type: 'text', label: adminLabel('siteName'), localized: true }, { name: 'titleTemplate', type: 'text', label: adminLabel('titleTemplate'), localized: true }, { name: 'defaultDescription', type: 'textarea', label: adminLabel('defaultDescription'), localized: true },
      { name: 'defaultKeywords', type: 'text', label: adminLabel('defaultKeywords'), localized: true, admin: { description: adminTabLabel('keywordsDescription') } },
    ] },
    { label: adminTabLabel('socialDefaults'), fields: [
      { name: 'defaultOpenGraphImage', type: 'upload', label: adminLabel('defaultOpenGraphImage'), relationTo: mediaCollection, localized: true }, { name: 'defaultTwitterCard', type: 'select', label: adminLabel('defaultTwitterCard'), localized: true, options: [{ label: adminLabel('summary'), value: 'summary' }, { label: adminLabel('summaryLargeImage'), value: 'summary_large_image' }] },
      { name: 'defaultOpenGraphType', type: 'text', localized: true }, { name: 'defaultTwitterSite', type: 'text', localized: true }, { name: 'defaultTwitterCreator', type: 'text', localized: true }, { name: 'defaultLocale', type: 'text', localized: true },
    ] },
    { label: adminTabLabel('defaultRobots'), fields: [{ name: 'defaultRobots', type: 'group', localized: true, fields: [
      { name: 'mode', type: 'select', required: true, defaultValue: 'index-follow', options: ['index-follow', 'noindex-follow', 'index-nofollow', 'noindex-nofollow', 'custom'] }, { name: 'directives', type: 'text', admin: { condition: (_, siblingData) => siblingData?.mode === 'custom' } },
    ] }] },
    { label: adminTabLabel('schema'), fields: [
      { name: 'globalSchemas', type: 'array', admin: { hidden: true }, fields: schemaTemplateFields('global') },
      { name: 'collectionSchemas', type: 'array', fields: [
        { name: 'collection', type: 'select', required: true, options: Object.keys(collectionVariables) },
        { name: 'templates', type: 'array', fields: schemaTemplateFields('collection') },
      ], admin: { hidden: true } },
      { name: 'schemaManager', type: 'ui', admin: { components: { Field: SEO_SETTINGS_SCHEMA_MANAGER_ADMIN_COMPONENT }, custom: { seo: { mode: 'settings', collections: Object.keys(collectionVariables), collectionVariables, defaultLocale, globalVariables, labeledCollections } } } },
    ] },
    { label: adminTabLabel('robotsTxt'), fields: [{ name: 'robots', type: 'group', localized: true, fields: [
      { name: 'mode', type: 'select', required: true, defaultValue: 'generated', options: ['generated', 'override'] },
      { name: 'groups', type: 'array', fields: [{ name: 'userAgent', type: 'text', required: true, validate: validateRobotsToken }, { name: 'allow', type: 'array', fields: [{ name: 'path', type: 'text', validate: validateRobotsToken }] }, { name: 'disallow', type: 'array', fields: [{ name: 'path', type: 'text', validate: validateRobotsToken }] }] },
      { name: 'overrideText', type: 'textarea', admin: { condition: (_, siblingData) => siblingData?.mode === 'override' } },
    ] }] },
  ] }],
})
