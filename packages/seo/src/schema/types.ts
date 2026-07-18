export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }
export type JsonObject = { [key: string]: JsonValue }

export type SeoJsonPatchOperation =
  | { op: 'add' | 'replace'; path: string; value: unknown }
  | { op: 'remove'; path: string }

export type SeoSchemaTemplate = {
  id: string
  name: string
  schema: JsonObject
  /** Localized value-only changes to the shared template structure. */
  valueOverrides?: SeoJsonPatchOperation[]
  isDefault?: boolean
}

export type SeoCollectionSchemaTemplates = {
  collection: string
  templates: SeoSchemaTemplate[]
}

export type SeoSchemaInstance = {
  /** Stable ID of a collection template. Repeated template IDs are valid. */
  templateId: string
  overrides?: SeoJsonPatchOperation[]
}

export type SeoGlobalSchemaOverride = {
  schemaId: string
  overrides?: SeoJsonPatchOperation[]
}

export type SeoSchemaVariable = {
  collection: string
  label: string
  path: string
  /** False for suggestions which are not available in every enabled collection. */
  availableInEveryCollection?: boolean
}
