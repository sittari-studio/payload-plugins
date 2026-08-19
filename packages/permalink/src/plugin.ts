import type {
  CollectionConfig,
  Config,
  Field,
  Plugin,
  UIField,
} from 'payload'

import {
  findField,
  getDefaultLocale,
  getLocaleCodes,
  validateFinalConfig,
} from './config.js'
import {
  createPathAfterChangeHook,
  createPathAfterDeleteHook,
  createPathBeforeChangeHook,
  markPathUnresolvedOperation,
} from './hook.js'
import { cleanPathSegment } from './path.js'
import { rebuildDocumentPathsWithPayload } from './rebuild.js'
import {
  backfillPublishedPathRoutes,
  createPathRoutesCollection,
  PATH_ROUTES_COLLECTION,
} from './routes.js'
import { createPermalinkSlugField } from './slug.js'
import { pathLabel } from './translations.js'
import {
  PATH_FIELD_RUNTIME_CONFIG_KEY,
  type PathCollectionOptions,
  type PathFieldRuntimeConfig,
  type PermalinkPluginConfig,
} from './types.js'

const PERMALINK_PLUGIN_SLUG = '@sittari/payload-permalink'
const PERMALINK_FIELD_COMPONENT =
  '@sittari/payload-permalink/client#PermalinkField'
const RESTORE_AS_DRAFT_STYLES_COMPONENT =
  '@sittari/payload-permalink/client#RestoreAsDraftStyles'
const PERMALINK_FIELD_NAME = 'sittariPermalink'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const normalizeSiteUrl = (siteUrl: unknown): string => {
  if (typeof siteUrl !== 'string' || siteUrl.trim().length === 0) {
    throw new Error('@sittari/payload-permalink: siteUrl must be a non-empty URL.')
  }
  const parsed = new URL(siteUrl)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('@sittari/payload-permalink: siteUrl must use http or https.')
  }
  return siteUrl.replace(/\/+$/g, '')
}

const normalizeConfig = (
  pluginConfig: PermalinkPluginConfig,
): PathFieldRuntimeConfig & { siteUrl: string } => {
  if (!isRecord(pluginConfig.collections)) {
    throw new Error('@sittari/payload-permalink: collections must be a mapping.')
  }

  const localePrefix = pluginConfig.localePrefix ?? 'as-needed'
  if (localePrefix !== 'always' && localePrefix !== 'as-needed') {
    throw new Error(
      '@sittari/payload-permalink: localePrefix must be "always" or "as-needed".',
    )
  }

  const collections: Record<string, PathCollectionOptions> = {}
  for (const [slug, value] of Object.entries(pluginConfig.collections)) {
    if (!slug.trim()) {
      throw new Error(
        '@sittari/payload-permalink: collection slugs must be non-empty.',
      )
    }
    if (value === false) continue
    if (!isRecord(value) || typeof value.prefix !== 'string') {
      throw new Error(
        `@sittari/payload-permalink: collections.${slug} must provide a string prefix.`,
      )
    }
    if (
      value.parentField !== undefined &&
      (typeof value.parentField !== 'string' || !value.parentField.trim())
    ) {
      throw new Error(
        `@sittari/payload-permalink: collections.${slug}.parentField must be a non-empty string.`,
      )
    }

    collections[slug] = {
      prefix: cleanPathSegment(value.prefix),
      ...(value.parentField ? { parentField: value.parentField } : {}),
    }
  }

  if (Object.keys(collections).length === 0) {
    throw new Error(
      '@sittari/payload-permalink: at least one collection must be enabled.',
    )
  }

  return {
    collections,
    localePrefix,
    siteUrl: normalizeSiteUrl(pluginConfig.siteUrl),
  }
}

const createPathField = (localized: boolean): Field => ({
  name: 'path',
  type: 'text',
  label: pathLabel,
  localized,
  access: {
    create: () => false,
    update: () => false,
  },
  admin: {
    hidden: true,
    readOnly: true,
  },
})

const hideSlugEditor = (fields: Field[]): Field[] =>
  fields.map((field): Field => {
    if ('name' in field && field.name === 'slug') {
      return {
        ...field,
        admin: { ...field.admin, hidden: true },
      } as Field
    }
    if (field.type === 'tabs') {
      return {
        ...field,
        tabs: field.tabs.map((tab) => ({
          ...tab,
          fields: hideSlugEditor(tab.fields),
        })),
      }
    }
    if ('fields' in field && Array.isArray(field.fields)) {
      return {
        ...field,
        fields: hideSlugEditor(field.fields),
      } as Field
    }
    return field
  })

const insertPermalinkField = (
  fields: Field[],
  useAsTitle: string,
  permalink: UIField,
): Field[] => {
  const index = fields.findIndex(
    (field) => 'name' in field && field.name === useAsTitle,
  )
  if (index === -1) return [permalink, ...fields]
  return [...fields.slice(0, index + 1), permalink, ...fields.slice(index + 1)]
}

const assertCollectionIsReady = (
  config: Config,
  slug: string,
  options: PathCollectionOptions,
): CollectionConfig => {
  const collection = config.collections?.find((candidate) => candidate.slug === slug)
  if (!collection) {
    throw new Error(
      `@sittari/payload-permalink: configured collection "${slug}" does not exist.`,
    )
  }

  for (const reserved of ['path', PERMALINK_FIELD_NAME]) {
    if (findField(collection.fields, reserved)) {
      throw new Error(
        `@sittari/payload-permalink: collection "${slug}" already has a field named "${reserved}".`,
      )
    }
  }

  const existingSlug = findField(collection.fields, 'slug')
  if (existingSlug && existingSlug.type !== 'text') {
    throw new Error(
      `@sittari/payload-permalink: collection "${slug}" has an incompatible "slug" field.`,
    )
  }

  if (options.parentField) {
    const parent = findField(collection.fields, options.parentField)
    if (!parent || parent.type !== 'relationship') {
      throw new Error(
        `@sittari/payload-permalink: "${slug}.${options.parentField}" must already be a relationship field. Configure nested-docs before permalinkPlugin.`,
      )
    }
    if (parent.hasMany) {
      throw new Error(
        `@sittari/payload-permalink: "${slug}.${options.parentField}" must be a single relationship.`,
      )
    }
    const relationTo = Array.isArray(parent.relationTo)
      ? parent.relationTo
      : [parent.relationTo]
    if (!relationTo.includes(slug as never)) {
      throw new Error(
        `@sittari/payload-permalink: "${slug}.${options.parentField}" must relate to "${slug}".`,
      )
    }
  }

  return collection
}

export const permalinkPlugin = (
  pluginConfig: PermalinkPluginConfig,
): Plugin => {
  const plugin: Plugin = (incomingConfig) => {
    if (pluginConfig.enabled === false) return incomingConfig
    const normalized = normalizeConfig(pluginConfig)
    const { collections, localePrefix, siteUrl } = normalized
    const runtime: PathFieldRuntimeConfig = { collections, localePrefix }
    const localeCodes = getLocaleCodes(incomingConfig)
    const defaultLocale = getDefaultLocale(incomingConfig)

    if (
      incomingConfig.collections?.some(
        ({ slug }) => slug === PATH_ROUTES_COLLECTION,
      )
    ) {
      throw new Error(
        `@sittari/payload-permalink: a collection with slug "${PATH_ROUTES_COLLECTION}" already exists.`,
      )
    }

    const transformed = new Map<string, CollectionConfig>()
    for (const [slug, options] of Object.entries(collections)) {
      const collection = assertCollectionIsReady(incomingConfig, slug, options)
      const collectionHasDrafts =
        typeof collection.versions === 'object' && Boolean(collection.versions.drafts)
      const hideRestoreAsPublished = Boolean(collection.trash && collectionHasDrafts)
      const useAsSlug =
        typeof collection.admin?.useAsTitle === 'string'
          ? collection.admin.useAsTitle
          : 'title'
      const hasSlug = Boolean(findField(collection.fields, 'slug'))
      const slugField = hasSlug
        ? null
        : createPermalinkSlugField({ localized: localeCodes.length > 0 })
      const permalinkField: UIField = {
        name: PERMALINK_FIELD_NAME,
        type: 'ui',
        admin: {
          disableListColumn: true,
          components: {
            Field: {
              path: PERMALINK_FIELD_COMPONENT,
              clientProps: {
                pathFieldName: 'path',
                prefix: options.prefix,
                siteUrl,
                slugFieldName: 'slug',
                slugSourceFieldName: useAsSlug,
              },
            },
          },
        },
      }

      let fields = hideSlugEditor(collection.fields)
      if (slugField) fields = [...fields, slugField]
      fields = insertPermalinkField(fields, useAsSlug, permalinkField)
      fields = [...fields, createPathField(localeCodes.length > 0)]

      const admin = hideRestoreAsPublished
        ? {
            ...collection.admin,
            components: {
              ...collection.admin?.components,
              beforeList: [
                ...(collection.admin?.components?.beforeList ?? []),
                RESTORE_AS_DRAFT_STYLES_COMPONENT,
              ],
              edit: {
                ...collection.admin?.components?.edit,
                beforeDocumentControls: [
                  ...(collection.admin?.components?.edit?.beforeDocumentControls ?? []),
                  RESTORE_AS_DRAFT_STYLES_COMPONENT,
                ],
              },
            },
          }
        : collection.admin

      transformed.set(slug, {
        ...collection,
        admin,
        fields,
        hooks: {
          ...collection.hooks,
          beforeOperation: [
            ...(collection.hooks?.beforeOperation ?? []),
            markPathUnresolvedOperation,
          ],
          beforeChange: [
            ...(collection.hooks?.beforeChange ?? []),
            createPathBeforeChangeHook({
              collection: slug,
              collectionHasDrafts,
              defaultLocale,
              localeCodes,
              localePrefix,
              options,
              useAsSlug,
            }),
          ],
          afterChange: [
            ...(collection.hooks?.afterChange ?? []),
            createPathAfterChangeHook({
              collection: slug,
              collectionHasDrafts,
              defaultLocale,
              localeCodes,
            }),
          ],
          afterDelete: [
            ...(collection.hooks?.afterDelete ?? []),
            createPathAfterDeleteHook({ collection: slug }),
          ],
        },
      })
    }

    const output: Config = {
      ...incomingConfig,
      collections: [
        ...(incomingConfig.collections ?? []).map(
          (collection) => transformed.get(collection.slug) ?? collection,
        ),
        createPathRoutesCollection(localeCodes.length > 0),
      ],
      custom: {
        ...(incomingConfig.custom ?? {}),
        [PATH_FIELD_RUNTIME_CONFIG_KEY]: runtime,
      },
    }

    output.onInit = async (payload) => {
      await incomingConfig.onInit?.(payload)
      validateFinalConfig(payload.config as unknown as Config, runtime)
      const routes = await payload.find({
        collection: PATH_ROUTES_COLLECTION as never,
        depth: 0,
        limit: 1,
        overrideAccess: true,
        pagination: false,
      } as never)
      await rebuildDocumentPathsWithPayload(payload, { missingOnly: true })
      if (routes.docs.length === 0) {
        await backfillPublishedPathRoutes(payload, { force: true })
      }
    }
    return output
  }
  plugin.slug = PERMALINK_PLUGIN_SLUG
  plugin.options = pluginConfig as unknown as Record<string, unknown>
  return plugin
}

export {
  PERMALINK_FIELD_COMPONENT,
  PERMALINK_FIELD_NAME,
  RESTORE_AS_DRAFT_STYLES_COMPONENT,
}
export default permalinkPlugin
