import type { Config, Field, Payload } from 'payload'

import {
  PATH_FIELD_RUNTIME_CONFIG_KEY,
  type PathFieldRuntimeConfig,
} from './types.js'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

export const getLocaleCodes = (config: Config): string[] => {
  if (!config.localization) return []
  return config.localization.locales.map((locale) =>
    typeof locale === 'string' ? locale : locale.code,
  )
}

export const getDefaultLocale = (config: Config): string | undefined =>
  config.localization === false ? undefined : config.localization?.defaultLocale

export const getPathRuntimeConfig = (
  payload: Payload,
): PathFieldRuntimeConfig | undefined => {
  const value = payload.config.custom?.[PATH_FIELD_RUNTIME_CONFIG_KEY]
  if (!isRecord(value) || !isRecord(value.collections)) return undefined
  return value as PathFieldRuntimeConfig
}

export const findField = (
  fields: Field[],
  name: string,
): Field | undefined => {
  for (const field of fields) {
    if ('name' in field && field.name === name) return field

    if ('fields' in field && Array.isArray(field.fields)) {
      const nested = findField(field.fields, name)
      if (nested) return nested
    }

    if (field.type === 'tabs') {
      for (const tab of field.tabs) {
        const nested = findField(tab.fields, name)
        if (nested) return nested
      }
    }

    if (field.type === 'blocks') {
      for (const block of field.blocks) {
        if (typeof block === 'string') continue
        const nested = findField(block.fields, name)
        if (nested) return nested
      }
    }
  }

  return undefined
}

export const validateFinalConfig = (
  config: Config,
  runtime: PathFieldRuntimeConfig,
): void => {
  for (const [slug, options] of Object.entries(runtime.collections)) {
    const collection = config.collections?.find((candidate) => candidate.slug === slug)
    if (!collection) {
      throw new Error(
        `@sittari/payload-path-field: configured collection "${slug}" does not exist.`,
      )
    }

    const pathField = findField(collection.fields, 'path')
    if (!pathField) {
      throw new Error(
        `@sittari/payload-path-field: collection "${slug}" is missing its generated "path" field.`,
      )
    }
    if (
      pathField.type !== 'text' ||
      pathField.index !== true ||
      pathField.unique !== true ||
      pathField.admin?.readOnly !== true
    ) {
      throw new Error(
        `@sittari/payload-path-field: collection "${slug}" has an incompatible "path" field after plugin configuration.`,
      )
    }

    if (!options.parentField) continue
    const parent = findField(collection.fields, options.parentField)
    if (!parent || parent.type !== 'relationship') {
      throw new Error(
        `@sittari/payload-path-field: "${slug}.${options.parentField}" must be a relationship field.`,
      )
    }
    if (parent.hasMany) {
      throw new Error(
        `@sittari/payload-path-field: "${slug}.${options.parentField}" must be a single relation ship.`,
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
}
