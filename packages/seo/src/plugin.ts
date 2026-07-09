import type { Config, Field, Plugin } from 'payload'

import {
  DEFAULT_SEO_NAMES,
  SEO_PLUGIN_MARKER,
  type SeoAdminCustom,
  type SeoEnabledPluginConfig,
  type SeoPluginConfig,
} from './types.js'

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

const requireNonEmptyString = (value: unknown, label: string): void => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`@krameri/payload-seo: ${label} must be a non-empty string.`)
  }
}

const requireFunction = (value: unknown, label: string): void => {
  if (typeof value !== 'function') {
    throw new Error(`@krameri/payload-seo: ${label} must be a function.`)
  }
}

const validateMappings = (value: unknown, label: string): void => {
  if (value === undefined) return
  if (!isRecord(value) || Object.values(value).some((path) => typeof path !== 'string' || !path)) {
    throw new Error(`@krameri/payload-seo: ${label} must map names to non-empty dot paths.`)
  }
}

export const resolveSeoNames = (names?: SeoPluginConfig['names']) => ({
  ...DEFAULT_SEO_NAMES,
  ...names,
})

/** Validates the plugin-owned configuration before any Payload config is changed. */
export const validateSeoPluginConfig = (config: SeoEnabledPluginConfig): void => {
  if (!isRecord(config)) {
    throw new Error('@krameri/payload-seo: plugin configuration must be an object.')
  }

  if (config.enabled !== undefined && config.enabled !== true) {
    throw new Error('@krameri/payload-seo: enabled must be a boolean.')
  }

  if (!isRecord(config.collections) || Object.keys(config.collections).length === 0) {
    throw new Error('@krameri/payload-seo: collections must be a non-empty mapping.')
  }

  for (const [slug, collection] of Object.entries(config.collections)) {
    requireNonEmptyString(slug, 'collection slug')
    if (!isRecord(collection)) {
      throw new Error(`@krameri/payload-seo: collections.${slug} must be an object.`)
    }
    requireNonEmptyString(collection.schemaType, `collections.${slug}.schemaType`)
    validateMappings(collection.fields, `collections.${slug}.fields`)
    validateMappings(collection.schema, `collections.${slug}.schema`)
    if (collection.lastModified !== undefined) {
      requireFunction(collection.lastModified, `collections.${slug}.lastModified`)
    }
    if (collection.media !== undefined) {
      if (!isRecord(collection.media)) {
        throw new Error(`@krameri/payload-seo: collections.${slug}.media must be an object.`)
      }
      requireNonEmptyString(collection.media.collection, `collections.${slug}.media.collection`)
    }
    if (collection.sitemap !== undefined && (!isRecord(collection.sitemap) || typeof collection.sitemap.enabled !== 'boolean')) {
      throw new Error(`@krameri/payload-seo: collections.${slug}.sitemap.enabled must be a boolean.`)
    }
  }

  if (!isRecord(config.media)) {
    throw new Error('@krameri/payload-seo: media must be an object.')
  }
  requireNonEmptyString(config.media.collection, 'media.collection')
  requireFunction(config.media.resolveMediaUrl, 'media.resolveMediaUrl')
  requireFunction(config.resolveUrl, 'resolveUrl')
  requireFunction(config.resolveChunkUrl, 'resolveChunkUrl')

  const names = resolveSeoNames(config.names)
  requireNonEmptyString(names.seoField, 'names.seoField')
  requireNonEmptyString(names.settingsGlobal, 'names.settingsGlobal')
  requireNonEmptyString(names.redirectsCollection, 'names.redirectsCollection')

  if (config.robots !== undefined && (!isRecord(config.robots) || (config.robots.resolveSitemapUrls !== undefined && typeof config.robots.resolveSitemapUrls !== 'function'))) {
    throw new Error('@krameri/payload-seo: robots.resolveSitemapUrls must be a function.')
  }
}

const getSelectedCollection = (collections: CollectionConfig[], slug: string): CollectionConfig => {
  const collection = collections.find((candidate) => candidate.slug === slug)
  if (!collection) {
    throw new Error(`@krameri/payload-seo: configured collection "${slug}" does not exist in Payload config.`)
  }
  return collection
}

const assertNoGeneratedNameCollisions = (incomingConfig: Config, config: SeoEnabledPluginConfig): void => {
  const names = resolveSeoNames(config.names)
  const collections = incomingConfig.collections ?? []

  for (const slug of Object.keys(config.collections)) {
    const collection = getSelectedCollection(collections, slug)
    const conflict = collection.fields.find((field) => hasNamedField(field, names.seoField))
    if (conflict && !hasGeneratedMarker(conflict)) {
      throw new Error(`@krameri/payload-seo: collection "${slug}" already has a field named "${names.seoField}".`)
    }
  }

  const settings = (incomingConfig.globals ?? []).find((global) => global.slug === names.settingsGlobal)
  if (settings && !hasGeneratedMarker(settings as GlobalConfig)) {
    throw new Error(`@krameri/payload-seo: a Global named "${names.settingsGlobal}" already exists.`)
  }

  const redirects = collections.find((collection) => collection.slug === names.redirectsCollection)
  if (redirects && !hasGeneratedMarker(redirects)) {
    throw new Error(`@krameri/payload-seo: a collection named "${names.redirectsCollection}" already exists.`)
  }
}

export const seoPlugin =
  (pluginConfig: SeoPluginConfig = {} as SeoPluginConfig): Plugin =>
  (incomingConfig: Config): Config => {
    if (!isRecord(pluginConfig)) {
      throw new Error('@krameri/payload-seo: plugin configuration must be an object.')
    }

    if (pluginConfig.enabled === false) {
      return incomingConfig
    }

    const enabledConfig = pluginConfig as SeoEnabledPluginConfig
    validateSeoPluginConfig(enabledConfig)
    assertNoGeneratedNameCollisions(incomingConfig, enabledConfig)

    // Milestone 1 intentionally performs no Payload mutations. Milestone 2 adds
    // the marked field, Global, and collection after this safety gate.
    return incomingConfig
  }

export default seoPlugin
