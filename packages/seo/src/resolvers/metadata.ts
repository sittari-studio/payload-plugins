import type {
  ResolvedSeoMetadata,
  SeoCollectionConfig,
  SeoDocument,
  SeoEnabledPluginConfig,
  SeoPluginConfig,
  SeoSchemaType,
} from '../types.js'
import { getByPath, getSeoGroup } from './document.js'
import { buildGeneratedSchema } from '../utils/generated-schema.js'
import { combineSiteUrl, nonEmptyString } from '../utils/urls.js'
import { isAbsoluteHttpUrl } from '../utils/validation.js'

type ResolverOptions = {
  collection: string
  config: SeoEnabledPluginConfig
  document: SeoDocument
  locale: string
  names?: SeoPluginConfig['names']
  settings: SeoDocument
}

const object = (value: unknown): SeoDocument =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as SeoDocument : {}

const select = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value) ? value as T : undefined

const validTitleTemplate = (value: unknown): string | undefined => {
  const template = nonEmptyString(value)
  return template && (template.match(/%s/g)?.length === 1) ? template : undefined
}

const resolveImage = async (value: unknown, config: SeoEnabledPluginConfig, locale: string): Promise<string | undefined> => {
  const media = object(value)
  if (Object.keys(media).length === 0) return undefined
  try {
    const url = await config.media.resolveMediaUrl({ media, locale })
    return isAbsoluteHttpUrl(url) ? url.trim() : undefined
  } catch {
    return undefined
  }
}

const resolveCanonical = async ({ seo, config, document, collection, locale, settings }: {
  seo: SeoDocument
  config: SeoEnabledPluginConfig
  document: SeoDocument
  collection: string
  locale: string
  settings: SeoDocument
}): Promise<string | undefined> => {
  const canonical = object(seo.canonical)
  const mode = select(canonical.mode, ['auto', 'manual', 'none'] as const) ?? 'auto'
  if (mode === 'none') return undefined
  if (mode === 'manual') return isAbsoluteHttpUrl(canonical.url) ? canonical.url.trim() : undefined
  try {
    return combineSiteUrl(settings.siteUrl, await config.resolveUrl({ collection, document, locale }))
  } catch {
    return undefined
  }
}

const resolveSchema = ({ seo, collection, document, settings, canonicalUrl }: {
  seo: SeoDocument
  collection: SeoCollectionConfig
  document: SeoDocument
  settings: SeoDocument
  canonicalUrl?: string
}): Record<string, unknown> | undefined => {
  const schema = object(seo.schema)
  const rawJson = nonEmptyString(schema.rawJson)
  if (rawJson) {
    try {
      const parsed: unknown = JSON.parse(rawJson)
      return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : undefined
    } catch {
      return undefined
    }
  }

  const result = buildGeneratedSchema({
    canonicalUrl,
    collectionSchema: collection.schema,
    defaultType: collection.schemaType,
    document,
    schema,
  })
  const type = result['@type'] as SeoSchemaType
  const organization = object(settings.organizationSchema)
  if (type === 'Organization' || type === 'LocalBusiness') {
    const name = nonEmptyString(organization.name) ?? nonEmptyString(settings.siteName)
    const url = isAbsoluteHttpUrl(organization.url) ? organization.url.trim() : undefined
    if (name) result.name = name
    if (url) result.url = url
  }
  return result
}

/** Resolves one document using only data already loaded in the requested locale. */
export const resolveSeoMetadataCore = async ({ collection: slug, config, document, locale, names, settings }: ResolverOptions): Promise<ResolvedSeoMetadata> => {
  const collection = config.collections[slug]
  if (!collection) return {}
  const seo = getSeoGroup(document, names?.seoField ?? 'seo')
  const title = nonEmptyString(seo.title) ?? nonEmptyString(getByPath(document, collection.fields?.title))
  const template = validTitleTemplate(settings.titleTemplate)
  const resolvedTitle = title && template ? template.replace('%s', title) : title
  const description = nonEmptyString(seo.description)
    ?? nonEmptyString(getByPath(document, collection.fields?.description))
    ?? nonEmptyString(settings.defaultDescription)
  const openGraph = object(seo.openGraph)
  const twitter = object(seo.twitter)
  const openGraphTitle = nonEmptyString(openGraph.title) ?? resolvedTitle
  const openGraphDescription = nonEmptyString(openGraph.description) ?? description
  const openGraphImage = await resolveImage(openGraph.image ?? settings.defaultOpenGraphImage, config, locale)
  const twitterTitle = nonEmptyString(twitter.title) ?? openGraphTitle
  const twitterDescription = nonEmptyString(twitter.description) ?? openGraphDescription
  const twitterImage = await resolveImage(twitter.image, config, locale) ?? openGraphImage
  const canonicalUrl = await resolveCanonical({ seo, config, document, collection: slug, locale, settings })
  const robots = object(seo.robots)
  const defaults = object(settings.defaultRobots)
  const index = select(robots.index, ['index', 'noindex'] as const) ?? select(defaults.index, ['index', 'noindex'] as const)
  const follow = select(robots.follow, ['follow', 'nofollow'] as const) ?? select(defaults.follow, ['follow', 'nofollow'] as const)
  const result: ResolvedSeoMetadata = {}
  if (resolvedTitle) result.title = resolvedTitle
  if (description) result.description = description
  if (canonicalUrl) result.canonicalUrl = canonicalUrl
  if (index || follow) result.robots = { ...(index ? { index } : {}), ...(follow ? { follow } : {}) }
  const og = { ...(openGraphTitle ? { title: openGraphTitle } : {}), ...(openGraphDescription ? { description: openGraphDescription } : {}), ...(openGraphImage ? { image: openGraphImage } : {}) }
  if (Object.keys(og).length) result.openGraph = og
  const card = select(twitter.card, ['summary', 'summary_large_image'] as const) ?? select(settings.defaultTwitterCard, ['summary', 'summary_large_image'] as const)
  const tw = { ...(twitterTitle ? { title: twitterTitle } : {}), ...(twitterDescription ? { description: twitterDescription } : {}), ...(twitterImage ? { image: twitterImage } : {}), ...(card ? { card } : {}) }
  if (Object.keys(tw).length) result.twitter = tw
  const schema = resolveSchema({ seo, collection, document, settings, canonicalUrl })
  if (schema) result.schema = schema
  return result
}
