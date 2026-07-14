import type { CollectionConfig, Field, RowField } from 'payload'

export type PageTypeConfig = {
  fields: Field[]
  label: string | { [locale: string]: string }
}

export type PageTypes = Record<string, PageTypeConfig>

export type PagesPluginConfig = {
  /** Block slugs made available to the default flexible page type. */
  blockSlugs?: string[]

  /** Enable or disable the plugin. */
  enabled?: boolean
  /** Enable or disable localization of the title field. */
  localizeTitle?: boolean
  /** Extend or replace the final config of the pages collection. */
  overrides?: (defaultCollection: CollectionConfig) => CollectionConfig

  /** Extend, remove, or replace the default page types. */
  pageTypes?: (args: { defaultPageTypes: PageTypes }) => PageTypes

  /** Override the default slug field. */
  slugField?: (args: { defaultSlugField: RowField }) => RowField
}
