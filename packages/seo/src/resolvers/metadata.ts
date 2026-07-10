import type { ResolvedSeoMetadata, SeoDocument, SeoEnabledPluginConfig, SeoPluginConfig } from '../types.js'
import { resolveEffectiveSeo } from './effective.js'

type ResolverOptions = {
  collection: string
  config: SeoEnabledPluginConfig
  document: SeoDocument
  locale: string
  names?: SeoPluginConfig['names']
  settings: SeoDocument
}

/** Framework-neutral projection of the shared effective SEO state. */
export const resolveSeoMetadataCore = async (input: ResolverOptions): Promise<ResolvedSeoMetadata> => {
  const effective = await resolveEffectiveSeo(input)
  const result: ResolvedSeoMetadata = {}
  if (effective.title) result.title = effective.title
  if (effective.description) result.description = effective.description
  if (effective.canonical.url) result.canonicalUrl = effective.canonical.url
  result.robots = { index: effective.robots.index, follow: effective.robots.follow, ...(effective.robots.custom?.length ? { custom: effective.robots.custom } : {}) }
  if (Object.keys(effective.social.openGraph).length) result.openGraph = effective.social.openGraph
  if (Object.keys(effective.social.twitter).length) result.twitter = effective.social.twitter
  if (effective.schema || effective.siteSchemas.length || effective.breadcrumbs.length) {
    result.schema = effective.siteSchemas.length || effective.breadcrumbs.length
      ? { '@context': 'https://schema.org', '@graph': [...(effective.schema ? [effective.schema] : []), ...effective.breadcrumbs, ...effective.siteSchemas] }
      : effective.schema
  }
  return result
}
