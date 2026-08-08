import type { CollectionConfig, Field, RowField } from 'payload'

export type PageTypeConfig = {
  fields: Field[]
  label: string | { [locale: string]: string }
}

export type PageTypes = Record<string, PageTypeConfig>

type SharedPagesPluginConfig = {
  /** Enable or disable the plugin. */
  enabled?: boolean
  /** Enable or disable localization of the title field. */
  localizeTitle?: boolean
  /** Extend or replace the final config of the pages collection. */
  overrides?: (defaultCollection: CollectionConfig) => CollectionConfig

  /** Override the default slug field. */
  slugField?: (args: { defaultSlugField: RowField }) => RowField
}

export type PagesPluginConfig = SharedPagesPluginConfig &
  (
    | {
        enabled: false
        pageTypes?: PageTypes
      }
    | {
        enabled?: boolean
        /** Page types available in the pages collection. */
        pageTypes: PageTypes
      }
  )
