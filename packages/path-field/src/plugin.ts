import type { CollectionConfig, Config, Field, Plugin } from 'payload'

import {
  findField,
  getDefaultLocale,
  getLocaleCodes,
  validateFinalConfig,
} from './config.js'
import { createPathBeforeChangeHook } from './hook.js'
import { rebuildDocumentPathsWithPayload } from './rebuild.js'
import { pathLabel } from './translations.js'
import {
  PATH_FIELD_RUNTIME_CONFIG_KEY,
  type PathCollectionOptions,
  type PathFieldPluginConfig,
  type PathFieldRuntimeConfig,
} from './types.js'

const PATH_FIELD_PLUGIN_SLUG = '@sittari/payload-path-field'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const normalizeConfig = (
  pluginConfig: PathFieldPluginConfig,
): PathFieldRuntimeConfig => {
  if (!isRecord(pluginConfig.collections)) {
    throw new Error(
      '@sittari/payload-path-field: collections must be a mapping.',
    )
  }
  if (typeof pluginConfig.resolveDocumentUrl !== 'function') {
    throw new Error(
      '@sittari/payload-path-field: resolveDocumentUrl must be a function.',
    )
  }

  const collections: Record<string, PathCollectionOptions> = {}
  for (const [slug, value] of Object.entries(pluginConfig.collections)) {
    if (!slug.trim()) {
      throw new Error(
        '@sittari/payload-path-field: collection slugs must be non-empty.',
      )
    }
    if (value === false) continue
    if (value === true) {
      collections[slug] = {}
      continue
    }
    if (!isRecord(value)) {
      throw new Error(
        `@sittari/payload-path-field: collections.${slug} must be true, false, or an options object.`,
      )
    }
    if (
      value.parentField !== undefined &&
      (typeof value.parentField !== 'string' || !value.parentField.trim())
    ) {
      throw new Error(
        `@sittari/payload-path-field: collections.${slug}.parentField must be a non-empty string.`,
      )
    }
    collections[slug] = {
      ...(value.parentField ? { parentField: value.parentField } : {}),
    }
  }

  if (Object.keys(collections).length === 0) {
    throw new Error(
      '@sittari/payload-path-field: at least one collection must be enabled.',
    )
  }
  return { collections }
}

const createPathField = (localized: boolean): Field => ({
  name: 'path',
  type: 'text',
  label: pathLabel,
  index: true,
  localized,
  unique: true,
  access: {
    create: () => false,
    update: () => false,
  },
  admin: {
    position: 'sidebar',
    readOnly: true,
  },
})

const assertCollectionIsReady = (
  config: Config,
  slug: string,
  options: PathCollectionOptions,
): CollectionConfig => {
  const collection = config.collections?.find((candidate) => candidate.slug === slug)
  if (!collection) {
    throw new Error(
      `@sittari/payload-path-field: configured collection "${slug}" does not exist.`,
    )
  }

  const path = findField(collection.fields, 'path')
  if (path) {
    throw new Error(
      `@sittari/payload-path-field: collection "${slug}" already has a field named "path".`,
    )
  }

  if (options.parentField) {
    const parent = findField(collection.fields, options.parentField)
    if (!parent || parent.type !== 'relationship') {
      throw new Error(
        `@sittari/payload-path-field: "${slug}.${options.parentField}" must already be a relationship field. Configure nested-docs before pathFieldPlugin.`,
      )
    }
    if (parent.hasMany) {
      throw new Error(
        `@sittari/payload-path-field: "${slug}.${options.parentField}" must be a single relationship.`,
      )
    }
    const relationTo = Array.isArray(parent.relationTo)
      ? parent.relationTo
      : [parent.relationTo]
    if (!relationTo.includes(slug as never)) {
      throw new Error(
        `@sittari/payload-path-field: "${slug}.${options.parentField}" must relate to "${slug}".`,
      )
    }
  }

  return collection
}

export const pathFieldPlugin = (
  pluginConfig: PathFieldPluginConfig,
): Plugin => {
  const plugin: Plugin = (incomingConfig) => {
    if (pluginConfig.enabled === false) return incomingConfig
    const runtime = normalizeConfig(pluginConfig)
    const localeCodes = getLocaleCodes(incomingConfig)
    const defaultLocale = getDefaultLocale(incomingConfig)

    const transformed = new Map<string, CollectionConfig>()
    for (const [slug, options] of Object.entries(runtime.collections)) {
      const collection = assertCollectionIsReady(incomingConfig, slug, options)
      transformed.set(slug, {
        ...collection,
        fields: [...collection.fields, createPathField(localeCodes.length > 0)],
        hooks: {
          ...collection.hooks,
          beforeChange: [
            ...(collection.hooks?.beforeChange ?? []),
            createPathBeforeChangeHook({
              collection: slug,
              defaultLocale,
              localeCodes,
              options,
              resolver: pluginConfig.resolveDocumentUrl,
            }),
          ],
        },
      })
    }

    const output: Config = {
      ...incomingConfig,
      collections: (incomingConfig.collections ?? []).map(
        (collection) => transformed.get(collection.slug) ?? collection,
      ),
      custom: {
        ...(incomingConfig.custom ?? {}),
        [PATH_FIELD_RUNTIME_CONFIG_KEY]: runtime,
      },
    }

    output.onInit = async (payload) => {
      await incomingConfig.onInit?.(payload)
      validateFinalConfig(payload.config as unknown as Config, runtime)
      await rebuildDocumentPathsWithPayload(payload, { missingOnly: true })
    }
    return output
  }
  plugin.slug = PATH_FIELD_PLUGIN_SLUG
  plugin.options = pluginConfig as unknown as Record<string, unknown>
  return plugin
}

export default pathFieldPlugin
