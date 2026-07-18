import type { JsonObject, SeoJsonPatchOperation, SeoSchemaVariable } from '../../schema/types.js'

export type StoredSchemaTemplate = {
  id?: string
  templateId: string
  name: string
  schema: JsonObject
  valueOverrides?: SeoJsonPatchOperation[]
  isDefault?: boolean
}

export type StoredCollectionSchemas = {
  id?: string
  collection: string
  templates?: StoredSchemaTemplate[]
}

export type StoredSchemaInstance = {
  id?: string
  templateId: string
  overrides?: SeoJsonPatchOperation[]
}

export type StoredGlobalOverride = {
  id?: string
  schemaId: string
  overrides?: SeoJsonPatchOperation[]
}

export type SchemaManagerCustom = {
  apiRoute?: string
  collection?: string
  collections?: string[]
  collectionVariables?: Record<string, SeoSchemaVariable[]>
  defaultLocale?: string
  globalVariables?: SeoSchemaVariable[]
  labeledCollections?: string[]
  mode: 'document' | 'settings'
  settingsGlobal?: string
}

export type EditorDraft = {
  isDefault?: boolean
  name: string
  schema: JsonObject
  templateId: string
}

export const isLocalizedSchemaLocale = ({ defaultLocale, locale, localization }: {
  defaultLocale?: string
  locale?: string
  localization?: unknown
}): boolean => Boolean(localization && defaultLocale && locale && locale !== defaultLocale)

export type TemplateEndpointResponse = {
  collectionTemplates: StoredSchemaTemplate[]
  defaultLocale?: string
  globalSchemas: StoredSchemaTemplate[]
}

export const createClientId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  return `schema-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export const schemaTypeLabel = (schema: JsonObject): string =>
  typeof schema['@type'] === 'string' && schema['@type'] ? schema['@type'] : 'Thing'

export const resolveCollectionLabel = (label: Record<string, string> | string | undefined, slug: string, language: string): string => {
  if (typeof label === 'string') return label || slug
  if (!label) return slug
  const normalizedLanguage = language.toLowerCase()
  const baseLanguage = normalizedLanguage.split('-')[0]
  const matchingKey = Object.keys(label).find((key) => {
    const normalizedKey = key.toLowerCase()
    return normalizedKey === normalizedLanguage || normalizedKey === baseLanguage
  })
  return (matchingKey && label[matchingKey]) || slug
}
