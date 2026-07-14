import type { Config, Endpoint, Field, Plugin, TabsField } from 'payload'

import {
  DEFAULT_SEO_NAMES,
  SEO_PLUGIN_MARKER,
  type SeoAdminCustom,
  type SeoEnabledPluginConfig,
  type SeoPluginConfig,
} from './types.js'
import { createRedirectsCollection } from './collections/redirects.js'
import { createSeoPreviewEndpoint } from './endpoints/preview.js'
import { createSeoField, isSupportedVisualField } from './fields/seo.js'
import { createSeoSettingsGlobal } from './globals/seo-settings.js'
import { SEO_RUNTIME_CONFIG_KEY } from './helpers/config.js'
import { adminTabLabel } from './admin/translations.js'
import { normalizeSiteUrl } from './utils/urls.js'

type CollectionConfig = NonNullable<Config['collections']>[number]
type GlobalConfig = NonNullable<Config['globals']>[number]

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasGeneratedMarker = (value: { admin?: unknown }): boolean => {
  if (!isRecord(value.admin) || !isRecord(value.admin.custom)) {
    return false
  }

  return (value.admin.custom as SeoAdminCustom).seo?.marker === SEO_PLUGIN_MARKER
}

const hasNamedField = (field: Field, name: string): boolean => 'name' in field && field.name === name

const hasGeneratedTabs = (field: Field): boolean => field.type === 'tabs' && hasGeneratedMarker(field)

const hasGeneratedPreviewEndpoint = (endpoint: { custom?: unknown }): boolean =>
  isRecord(endpoint.custom) && (endpoint.custom as SeoAdminCustom).seo?.marker === SEO_PLUGIN_MARKER

const withPreviewEndpoint = (collection: CollectionConfig): Omit<Endpoint, 'root'>[] | false => {
  if (collection.endpoints === false) return false
  if (collection.endpoints?.some(hasGeneratedPreviewEndpoint)) return collection.endpoints
  return [...(collection.endpoints ?? []), createSeoPreviewEndpoint(collection.slug)]
}

const findNamedField = (fields: Field[], name: string): Field | undefined => {
  for (const field of fields) {
    if (hasNamedField(field, name)) return field
    if ('fields' in field && Array.isArray(field.fields)) {
      const nested = findNamedField(field.fields, name)
      if (nested) return nested
    }
    if (field.type === 'tabs') {
      for (const tab of field.tabs) {
        const nested = findNamedField(tab.fields, name)
        if (nested) return nested
      }
    }
    if (field.type === 'blocks') {
      for (const block of field.blocks) {
        if (typeof block === 'string') continue
        const nested = findNamedField(block.fields, name)
        if (nested) return nested
      }
    }
  }
  return undefined
}

const containsGeneratedTabs = (fields: Field[]): boolean => fields.some((field) => {
  if (hasGeneratedTabs(field)) return true
  if ('fields' in field && Array.isArray(field.fields) && containsGeneratedTabs(field.fields)) return true
  if (field.type === 'tabs') return field.tabs.some((tab) => containsGeneratedTabs(tab.fields))
  if (field.type === 'blocks') return field.blocks.some((block) => typeof block !== 'string' && containsGeneratedTabs(block.fields))
  return false
})

const createSeoTabs = (fields: Field[], seoField: Field): TabsField => ({
  type: 'tabs',
  admin: { custom: { seo: { marker: SEO_PLUGIN_MARKER } } },
  tabs: [
    { label: adminTabLabel('contentTab'), fields },
    { label: adminTabLabel('seoTab'), fields: [seoField] },
  ],
})

const appendSeoTab = (tabs: TabsField, seoField: Field): TabsField => ({
  ...tabs,
  tabs: [...tabs.tabs, { label: adminTabLabel('seoTab'), fields: [seoField] }],
})

const requireNonEmptyString = (value: unknown, label: string): void => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`@sittari/payload-seo: ${label} must be a non-empty string.`)
  }
}

const requireFunction = (value: unknown, label: string): void => {
  if (typeof value !== 'function') {
    throw new Error(`@sittari/payload-seo: ${label} must be a function.`)
  }
}

const validateMappings = (value: unknown, label: string): void => {
  if (value === undefined) return
  if (!isRecord(value) || Object.values(value).some((path) => typeof path !== 'string' || !path)) {
    throw new Error(`@sittari/payload-seo: ${label} must map names to non-empty dot paths.`)
  }
}

const validateSitemapFields = (value: unknown, label: string): void => {
  if (value === undefined) return
  if (!Array.isArray(value) || value.some((path) => typeof path !== 'string' || path.trim() === '')) {
    throw new Error(`@sittari/payload-seo: ${label} must be an array of non-empty field paths.`)
  }
}

const validSchemaTypes = new Set(['Article', 'FAQPage', 'LocalBusiness', 'Organization', 'Product', 'WebPage'])

export const resolveSeoNames = (names?: SeoPluginConfig['names']) => ({
  ...DEFAULT_SEO_NAMES,
  ...names,
})

/** Validates the plugin-owned configuration before any Payload config is changed. */
export const validateSeoPluginConfig = (config: SeoEnabledPluginConfig): void => {
  if (!isRecord(config)) {
    throw new Error('@sittari/payload-seo: plugin configuration must be an object.')
  }

  if (config.enabled !== undefined && config.enabled !== true) {
    throw new Error('@sittari/payload-seo: enabled must be a boolean.')
  }

  if (!isRecord(config.collections) || Object.keys(config.collections).length === 0) {
    throw new Error('@sittari/payload-seo: collections must be a non-empty mapping.')
  }

  for (const [slug, collection] of Object.entries(config.collections)) {
    requireNonEmptyString(slug, 'collection slug')
    if (!isRecord(collection)) {
      throw new Error(`@sittari/payload-seo: collections.${slug} must be an object.`)
    }
    requireNonEmptyString(collection.schemaType, `collections.${slug}.schemaType`)
    if (!validSchemaTypes.has(collection.schemaType)) throw new Error(`@sittari/payload-seo: collections.${slug}.schemaType is not supported.`)
    validateMappings(collection.fields, `collections.${slug}.fields`)
    validateMappings(collection.schema, `collections.${slug}.schema`)
    if (collection.breadcrumbs !== undefined) requireFunction(collection.breadcrumbs, `collections.${slug}.breadcrumbs`)
    if (collection.lastModified !== undefined) {
      requireFunction(collection.lastModified, `collections.${slug}.lastModified`)
    }
    if (collection.media !== undefined) {
      if (!isRecord(collection.media)) {
        throw new Error(`@sittari/payload-seo: collections.${slug}.media must be an object.`)
      }
      requireNonEmptyString(collection.media.collection, `collections.${slug}.media.collection`)
    }
    if (collection.sitemap !== undefined) {
      if (!isRecord(collection.sitemap) || (collection.sitemap.enabled !== undefined && typeof collection.sitemap.enabled !== 'boolean')) {
        throw new Error(`@sittari/payload-seo: collections.${slug}.sitemap.enabled must be a boolean.`)
      }
      validateSitemapFields(collection.sitemap.fields, `collections.${slug}.sitemap.fields`)
      if (collection.sitemap.exclude !== undefined) requireFunction(collection.sitemap.exclude, `collections.${slug}.sitemap.exclude`)
    }
    if (collection.visualFields?.some((field) => !isSupportedVisualField(field))) {
      throw new Error(`@sittari/payload-seo: collections.${slug}.visualFields may only contain named text, textarea, number, checkbox, select, date, or upload fields.`)
    }
  }

  if (!isRecord(config.media)) {
    throw new Error('@sittari/payload-seo: media must be an object.')
  }
  requireNonEmptyString(config.media.collection, 'media.collection')
  requireFunction(config.media.resolveMediaUrl, 'media.resolveMediaUrl')
  if (!normalizeSiteUrl(config.siteUrl)) {
    throw new Error('@sittari/payload-seo: siteUrl must be an absolute HTTP(S) origin without a path, query, fragment, or credentials.')
  }
  requireFunction(config.resolveUrl, 'resolveUrl')
  requireFunction(config.resolveChunkUrl, 'resolveChunkUrl')
  if (config.url?.trailingSlash !== undefined && config.url.trailingSlash !== 'always' && config.url.trailingSlash !== 'never') {
    throw new Error('@sittari/payload-seo: url.trailingSlash must be "always" or "never".')
  }
  if (config.hreflang?.xDefaultLocale !== undefined) requireNonEmptyString(config.hreflang.xDefaultLocale, 'hreflang.xDefaultLocale')
  if (config.diagnostics !== undefined) requireFunction(config.diagnostics, 'diagnostics')

  const names = resolveSeoNames(config.names)
  requireNonEmptyString(names.seoField, 'names.seoField')
  requireNonEmptyString(names.settingsGlobal, 'names.settingsGlobal')
  requireNonEmptyString(names.redirectsCollection, 'names.redirectsCollection')

  if (config.robots !== undefined && (!isRecord(config.robots) || (config.robots.resolveSitemapUrls !== undefined && typeof config.robots.resolveSitemapUrls !== 'function'))) {
    throw new Error('@sittari/payload-seo: robots.resolveSitemapUrls must be a function.')
  }
}

const getSelectedCollection = (collections: CollectionConfig[], slug: string): CollectionConfig => {
  const collection = collections.find((candidate) => candidate.slug === slug)
  if (!collection) {
    throw new Error(`@sittari/payload-seo: configured collection "${slug}" does not exist in Payload config.`)
  }
  return collection
}

const assertNoGeneratedNameCollisions = (incomingConfig: Config, config: SeoEnabledPluginConfig): void => {
  const names = resolveSeoNames(config.names)
  const collections = incomingConfig.collections ?? []

  for (const slug of Object.keys(config.collections)) {
    const collection = getSelectedCollection(collections, slug)
    const conflict = findNamedField(collection.fields, names.seoField)
    if (conflict && !hasGeneratedMarker(conflict)) {
      throw new Error(`@sittari/payload-seo: collection "${slug}" already has a field named "${names.seoField}".`)
    }
    if (collection.endpoints === false) {
      throw new Error(`@sittari/payload-seo: collection "${slug}" must allow endpoints for Admin SEO previews.`)
    }
    if (collection.endpoints?.some((endpoint) => endpoint.path === '/seo-preview' && !hasGeneratedPreviewEndpoint(endpoint))) {
      throw new Error(`@sittari/payload-seo: collection "${slug}" already has an endpoint at "/seo-preview".`)
    }
  }

  const settings = (incomingConfig.globals ?? []).find((global) => global.slug === names.settingsGlobal)
  if (settings && !hasGeneratedMarker(settings as GlobalConfig)) {
    throw new Error(`@sittari/payload-seo: a Global named "${names.settingsGlobal}" already exists.`)
  }

  const redirects = collections.find((collection) => collection.slug === names.redirectsCollection)
  if (redirects && !hasGeneratedMarker(redirects)) {
    throw new Error(`@sittari/payload-seo: a collection named "${names.redirectsCollection}" already exists.`)
  }
}

const assertMediaCollectionsExist = (incomingConfig: Config, config: SeoEnabledPluginConfig): void => {
  const slugs = new Set((incomingConfig.collections ?? []).map((collection) => collection.slug))
  const required = [config.media.collection, ...Object.values(config.collections).flatMap((collection) => collection.media?.collection ? [collection.media.collection] : [])]
  for (const slug of required) if (!slugs.has(slug)) throw new Error(`@sittari/payload-seo: media collection "${slug}" does not exist in Payload config.`)
}

export const seoPlugin =
  (pluginConfig: SeoPluginConfig = {} as SeoPluginConfig): Plugin =>
  (incomingConfig: Config): Config => {
    if (!isRecord(pluginConfig)) {
      throw new Error('@sittari/payload-seo: plugin configuration must be an object.')
    }

    if (pluginConfig.enabled === false) {
      return incomingConfig
    }

    const enabledConfig = pluginConfig as SeoEnabledPluginConfig
    validateSeoPluginConfig(enabledConfig)
    assertNoGeneratedNameCollisions(incomingConfig, enabledConfig)
    assertMediaCollectionsExist(incomingConfig, enabledConfig)

    const names = resolveSeoNames(enabledConfig.names)
    return {
      ...incomingConfig,
      custom: { ...incomingConfig.custom, [SEO_RUNTIME_CONFIG_KEY]: enabledConfig },
      collections: (incomingConfig.collections ?? []).map((collection) => {
        const seoConfig = enabledConfig.collections[collection.slug]
        if (!seoConfig || containsGeneratedTabs(collection.fields)) return collection
        const existingSeoField = findNamedField(collection.fields, names.seoField)
        const topLevelTabs = collection.fields.find((field): field is TabsField => field.type === 'tabs')

        // A collection that already owns its top-level tabs keeps that structure.
        // The generated field marker makes this branch safe to run repeatedly.
        if (topLevelTabs) {
          if (existingSeoField && hasGeneratedMarker(existingSeoField)) return collection
          const seoField = createSeoField({ collection: seoConfig, mediaCollection: enabledConfig.media.collection, name: names.seoField, trailingSlashPolicy: enabledConfig.url?.trailingSlash })
          return {
            ...collection,
            endpoints: withPreviewEndpoint(collection),
            fields: collection.fields.map((field) => field === topLevelTabs ? appendSeoTab(field, seoField) : field),
          }
        }

        const contentFields = existingSeoField && hasGeneratedMarker(existingSeoField)
          ? collection.fields.filter((field) => field !== existingSeoField)
          : collection.fields
        return {
          ...collection,
          endpoints: withPreviewEndpoint(collection),
          fields: [createSeoTabs(
            contentFields,
            createSeoField({ collection: seoConfig, mediaCollection: enabledConfig.media.collection, name: names.seoField, trailingSlashPolicy: enabledConfig.url?.trailingSlash }),
          )],
        }
      }).concat((incomingConfig.collections ?? []).some((collection) => collection.slug === names.redirectsCollection) ? [] : [createRedirectsCollection({ access: enabledConfig.access?.redirects, slug: names.redirectsCollection })]),
      globals: [...(incomingConfig.globals ?? []), ...((incomingConfig.globals ?? []).some((global) => global.slug === names.settingsGlobal) ? [] : [createSeoSettingsGlobal({ access: enabledConfig.access?.settings, slug: names.settingsGlobal, mediaCollection: enabledConfig.media.collection })])],
    }
  }

export default seoPlugin
