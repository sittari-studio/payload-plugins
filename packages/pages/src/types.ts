import type { Field, RowField, TextField } from 'payload'

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



  /** Extend or replace the final fields of the pages collection. */
  fields?: (args: { defaultFields: Field[] }) => Field[]

  /** Extend, remove, or replace the default page types. */
  pageTypes?: (args: { defaultPageTypes: PageTypes }) => PageTypes

  /** Override the default slug field. */
  slugField?: (args: { defaultSlugField: RowField }) => RowField
}


