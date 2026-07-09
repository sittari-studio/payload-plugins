import type { SeoDocument, SeoPayload } from '../types.js'
import { resolveSeoMetadata } from './metadata.js'

export const renderSchemaJsonLd = async (input: {
  payload: SeoPayload
  collection: string
  locale: string
  document: SeoDocument
} | {
  payload: SeoPayload
  collection: string
  locale: string
  id: string | number
}): Promise<Record<string, unknown> | null> => (await resolveSeoMetadata(input)).schema ?? null
