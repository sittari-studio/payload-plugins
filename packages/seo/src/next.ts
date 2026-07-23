import type { SeoDocument, SeoPayload } from './types.js'
import { resolveSeoMetadata } from './helpers/metadata.js'
import { robotsContent } from './utils/robots.js'

/** Structural Next.js Metadata projection; no Next.js runtime import is required. */
export const resolveNextMetadata = async (input: {
  payload: SeoPayload
  collection: string
  locale: string
  document: SeoDocument
} | {
  payload: SeoPayload
  collection: string
  locale: string
  id: string | number
}): Promise<Record<string, unknown>> => {
  const metadata = await resolveSeoMetadata(input)
  const result: Record<string, unknown> = {}
  if (metadata.title) result.title = metadata.title
  if (metadata.description) result.description = metadata.description
  if (metadata.keywords) result.keywords = metadata.keywords
  if (metadata.canonicalUrl || metadata.alternates) result.alternates = { ...(metadata.canonicalUrl ? { canonical: metadata.canonicalUrl } : {}), ...(metadata.alternates ? { languages: metadata.alternates } : {}) }
  if (metadata.robots) {
    result.robots = metadata.robots.custom?.length
      ? robotsContent(metadata.robots)
      : { ...(metadata.robots.index ? { index: metadata.robots.index === 'index' } : {}), ...(metadata.robots.follow ? { follow: metadata.robots.follow === 'follow' } : {}) }
  }
  if (metadata.openGraph) result.openGraph = { ...metadata.openGraph, ...(metadata.openGraph.image ? { images: [metadata.openGraph.image] } : {}) }
  if (metadata.twitter) result.twitter = { ...metadata.twitter, ...(metadata.twitter.image ? { images: [metadata.twitter.image] } : {}) }
  return result
}
