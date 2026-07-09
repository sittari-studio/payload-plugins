import type { SeoDocument } from '../types.js'

/** Reads a simple dot path without coercion or locale fallback. */
export const getByPath = (document: SeoDocument | undefined, path: string | undefined): unknown => {
  if (!document || !path) return undefined
  return path.split('.').reduce<unknown>((value, key) =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)[key]
      : undefined, document)
}

export const getSeoGroup = (document: SeoDocument, name: string): SeoDocument => {
  const value = document[name]
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as SeoDocument
    : {}
}
