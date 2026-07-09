import { getByPath } from '../resolvers/document.js'
import type { SeoDocument, SeoSchemaType } from '../types.js'

const schemaTypes = ['Article', 'FAQPage', 'LocalBusiness', 'Organization', 'Product', 'WebPage'] as const

export const isSchemaType = (value: unknown): value is SeoSchemaType =>
  typeof value === 'string' && (schemaTypes as readonly string[]).includes(value)

/** Builds the schema controlled by the visual editor, without applying a raw JSON override. */
export const buildGeneratedSchema = ({
  canonicalUrl,
  collectionSchema,
  defaultType,
  document,
  schema: suppliedSchema,
}: {
  canonicalUrl?: string
  collectionSchema?: Record<string, string>
  defaultType: SeoSchemaType
  document: SeoDocument
  schema?: SeoDocument
}): Record<string, unknown> => {
  const seo = document.seo && typeof document.seo === 'object' ? document.seo as SeoDocument : {}
  const schema = suppliedSchema ?? (seo.schema && typeof seo.schema === 'object' ? seo.schema as SeoDocument : {})
  const result: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': isSchemaType(schema.type) ? schema.type : defaultType,
  }

  if (canonicalUrl) result.url = canonicalUrl

  for (const [property, path] of Object.entries(collectionSchema ?? {})) {
    const value = getByPath(document, path)
    if (value !== undefined && value !== null && value !== '') result[property] = value
  }

  for (const [property, value] of Object.entries(schema.values && typeof schema.values === 'object' ? schema.values as SeoDocument : {})) {
    if (value !== undefined && value !== null && value !== '') result[property] = value
  }

  return result
}
