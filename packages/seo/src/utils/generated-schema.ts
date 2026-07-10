import { getByPath } from '../resolvers/document.js'
import type { SeoDocument, SeoSchemaType } from '../types.js'

const schemaTypes = ['Article', 'FAQPage', 'LocalBusiness', 'Organization', 'Product', 'WebPage'] as const
// Generated output owns vocabulary, type selection, and the canonical URL.
// `name` and `image` intentionally remain editor/mapping controlled.
const reservedSchemaKeys = new Set(['@context', '@type', 'url'])

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
    if (reservedSchemaKeys.has(property)) continue
    const value = getByPath(document, path)
    if (value !== undefined && value !== null && value !== '') result[property] = value
  }

  for (const [property, value] of Object.entries(schema.values && typeof schema.values === 'object' ? schema.values as SeoDocument : {})) {
    if (reservedSchemaKeys.has(property)) continue
    if (value !== undefined && value !== null && value !== '') result[property] = value
  }

  const type = result['@type'] as SeoSchemaType
  const string = (value: unknown): string | undefined => typeof value === 'string' && value.trim() ? value.trim() : undefined
  const value = (key: string): unknown => result[key]

  if (type === 'Article') {
    const author = string(value('author'))
    if (author) result.author = { '@type': 'Person', name: author }
    const headline = string(value('headline')) ?? string(value('name'))
    if (headline) result.headline = headline
  }

  if (type === 'Product') {
    const brand = string(value('brand'))
    if (brand) result.brand = { '@type': 'Brand', name: brand }
    const price = value('price')
    const priceCurrency = string(value('priceCurrency'))
    if (price !== undefined && price !== null && price !== '' && priceCurrency) {
      result.offers = { '@type': 'Offer', price, priceCurrency }
    }
    delete result.price
    delete result.priceCurrency
  }

  if (type === 'FAQPage') {
    const question = string(value('question'))
    const answer = string(value('answer'))
    if (question && answer) {
      result.mainEntity = [{ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } }]
    }
    delete result.question
    delete result.answer
  }

  if (type === 'LocalBusiness') {
    const address = string(value('address'))
    if (address) result.address = { '@type': 'PostalAddress', streetAddress: address }
  }

  return result
}
