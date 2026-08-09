import type {
  Block,
  Config,
  Field,
  GroupField,
  Plugin,
  RelationshipField,
  StaticLabel,
  TextField,
} from 'payload'

import { createResolveUrlHook } from './hooks/resolveUrl.js'
import { discardPayloadCollections } from './linkFields.js'
import {
  LINK_FIELD_MARKER,
  LINK_FIELD_RUNTIME_CONFIG_KEY,
  type LinkFieldAdminCustom,
  type LinkFieldPluginConfig,
} from './types.js'
import type { ReferenceSummaryCollections } from './utils/getReferenceSummary.js'
import { traverseFields } from './utils/traverseFields.js'

type CollectionConfig = NonNullable<Config['collections']>[number]
type RelationshipFilterOptions = RelationshipField['filterOptions']

const isGeneratedLinkField = (field: Field): field is GroupField => {
  if (field.type !== 'group') {
    return false
  }

  const custom = field.admin?.custom as LinkFieldAdminCustom | undefined

  return custom?.linkField?.marker === LINK_FIELD_MARKER
}

const isReferenceField = (field: Field): field is RelationshipField =>
  'name' in field && field.name === 'reference' && field.type === 'relationship'

const isUrlField = (field: Field): field is TextField =>
  'name' in field && field.name === 'url' && field.type === 'text'

const hasEmptyRelationTo = (field: RelationshipField): boolean =>
  Array.isArray(field.relationTo) && field.relationTo.length === 0

const getStringValue = (value: unknown): string | undefined =>
  typeof value === 'string' && value ? value : undefined

const getStaticLabel = (value: unknown): StaticLabel | undefined => {
  if (typeof value === 'string') {
    return value
  }

  if (
    value &&
    typeof value === 'object' &&
    Object.values(value).every((label) => typeof label === 'string')
  ) {
    return value as Record<string, string>
  }

  return undefined
}

const getCollectionLabel = (collection: CollectionConfig): StaticLabel =>
  getStaticLabel((collection.labels as { singular?: unknown } | undefined)?.singular) ??
  collection.slug

const getCollectionUseAsTitle = (collection: CollectionConfig): string | undefined => {
  const adminUseAsTitle = getStringValue(
    (collection.admin as { useAsTitle?: unknown } | undefined)?.useAsTitle,
  )

  if (adminUseAsTitle) {
    return adminUseAsTitle
  }

  return getStringValue((collection as { useAsSlug?: unknown }).useAsSlug)
}

const getReferenceSummaryCollections = (
  collections: CollectionConfig[] | undefined,
): ReferenceSummaryCollections =>
  Object.fromEntries(
    (collections ?? []).map((collection) => [
      collection.slug,
      {
        label: getCollectionLabel(collection),
        useAsTitle: getCollectionUseAsTitle(collection),
      },
    ]),
  )

const getApiRoute = (config: Config): string =>
  getStringValue((config.routes as { api?: unknown } | undefined)?.api) ?? '/api'

const withSelfReferenceFilter = (
  existingFilterOptions: RelationshipFilterOptions,
  ownerCollectionSlug: string | undefined,
): RelationshipFilterOptions => {
  if (!ownerCollectionSlug) {
    return existingFilterOptions
  }

  return async (args) => {
    const hasDocumentId = args.id !== undefined && args.id !== null && args.id !== ''
    const selfFilter =
      hasDocumentId && args.relationTo === ownerCollectionSlug
        ? {
          id: {
            not_equals: args.id,
          },
        }
        : true

    if (!existingFilterOptions) {
      return selfFilter
    }

    const existingFilter =
      typeof existingFilterOptions === 'function'
        ? await existingFilterOptions(args)
        : existingFilterOptions

    if (selfFilter === true) {
      return existingFilter
    }

    if (existingFilter === true) {
      return selfFilter
    }

    if (!existingFilter) {
      return existingFilter
    }

    return {
      and: [existingFilter, selfFilter],
    }
  }
}

const transformLinkField = ({
  allCollectionSlugs,
  apiRoute,
  collectionSummaries,
  field,
  ownerCollectionSlug,
  pluginConfig,
}: {
  allCollectionSlugs: string[]
  apiRoute: string
  collectionSummaries: ReferenceSummaryCollections
  field: GroupField
  ownerCollectionSlug?: string
  pluginConfig: LinkFieldPluginConfig
}): GroupField => ({
  ...field,
  admin: {
    ...field.admin,
    custom: {
      ...field.admin?.custom,
      linkField: {
        ...((field.admin?.custom as LinkFieldAdminCustom | undefined)?.linkField ?? {}),
        apiRoute,
        collections: collectionSummaries,
      },
    },
  },
  fields: field.fields.map((childField) => {
    if (isReferenceField(childField)) {
      return {
        ...childField,
        filterOptions: withSelfReferenceFilter(childField.filterOptions, ownerCollectionSlug),
        relationTo: discardPayloadCollections(
          hasEmptyRelationTo(childField) ? allCollectionSlugs : childField.relationTo,
        ),
      } as RelationshipField
    }

    if (isUrlField(childField)) {
      return {
        ...childField,
        hooks: {
          ...childField.hooks,
          afterRead: [
            ...(childField.hooks?.afterRead ?? []),
            createResolveUrlHook(pluginConfig.resolveDocumentUrl),
          ],
        },
        virtual: true,
      }
    }

    return childField
  }),
})

export const linkFieldPlugin =
  (pluginConfig: LinkFieldPluginConfig): Plugin =>
    (incomingConfig: Config): Config => {
      const allCollectionSlugs = (incomingConfig.collections ?? []).map(
        (collection) => collection.slug,
      )
      const apiRoute = getApiRoute(incomingConfig)
      const collectionSummaries = getReferenceSummaryCollections(incomingConfig.collections)

      const createTransformField =
        (ownerCollectionSlug?: string) =>
        (field: Field): Field => {
          if (!isGeneratedLinkField(field)) {
            return field
          }

          return transformLinkField({
            allCollectionSlugs,
            apiRoute,
            collectionSummaries,
            field,
            ownerCollectionSlug,
            pluginConfig,
          })
        }

      const transformBlock = (block: Block): Block => ({
        ...block,
        fields: traverseFields(block.fields, createTransformField()) ?? [],
      })

      const finalConfig: Config = {
        ...incomingConfig,
        blocks: incomingConfig.blocks?.map(transformBlock),
        collections: incomingConfig.collections?.map((collection) => ({
          ...collection,
          fields: traverseFields(collection.fields, createTransformField(collection.slug)) ?? [],
        })),
        globals: incomingConfig.globals?.map((global) => ({
          ...global,
          fields: traverseFields(global.fields, createTransformField()) ?? [],
        })),
        custom: {
          ...(incomingConfig.custom ?? {}),
          [LINK_FIELD_RUNTIME_CONFIG_KEY]: {
            resolveDocumentUrl: pluginConfig.resolveDocumentUrl,
          },
        },
      }
      return finalConfig
    }
