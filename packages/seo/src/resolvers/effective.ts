import type {
  CanonicalMode,
  ResolvedEffectiveSeo,
  RobotsMode,
  SeoDiagnostic,
  SeoDocument,
  SeoEnabledPluginConfig,
  SeoPreview,
  SeoRobotsDirectives,
} from '../types.js'
import { getByPath, getSeoGroup } from './document.js'
import { buildGeneratedSchema } from '../utils/generated-schema.js'
import { combineSiteUrl, isSameSiteUrl, nonEmptyString, normalizeCanonicalUrl, normalizeSiteUrl } from '../utils/urls.js'
import { isAbsoluteHttpUrl, isPlainJsonObject } from '../utils/validation.js'

type Input = {
  collection: string
  config: SeoEnabledPluginConfig
  document: SeoDocument
  locale: string
  names?: { seoField?: string }
  settings: SeoDocument
}

const object = (value: unknown): SeoDocument =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as SeoDocument : {}

const select = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value) ? value as T : undefined

const modeDirectives: Record<Exclude<RobotsMode, 'inherit' | 'custom'>, Required<SeoRobotsDirectives>> = {
  'index-follow': { index: 'index', follow: 'follow' },
  'noindex-follow': { index: 'noindex', follow: 'follow' },
  'index-nofollow': { index: 'index', follow: 'nofollow' },
  'noindex-nofollow': { index: 'noindex', follow: 'nofollow' },
}

const diagnostic = (input: Input, area: SeoDiagnostic['area'], message: string): void => {
  input.config.diagnostics?.({
    area,
    collection: input.collection,
    documentId: typeof input.document.id === 'string' || typeof input.document.id === 'number' ? input.document.id : undefined,
    locale: input.locale,
    message,
  })
}

const titleTemplate = (value: unknown): string | undefined => {
  const template = nonEmptyString(value)
  return template && (template.match(/%s/g)?.length === 1) ? template : undefined
}

const resolveImage = async (value: unknown, input: Input): Promise<string | undefined> => {
  const media = object(value)
  if (!Object.keys(media).length) return undefined
  try {
    const url = await input.config.media.resolveMediaUrl({ media, locale: input.locale })
    if (!isAbsoluteHttpUrl(url)) {
      diagnostic(input, 'media', 'Media resolver returned no valid absolute HTTP(S) URL.')
      return undefined
    }
    return url.trim()
  } catch {
    diagnostic(input, 'media', 'Media resolver failed.')
    return undefined
  }
}

export const resolveEffectiveRobots = (page: SeoDocument, settings: SeoDocument): ResolvedEffectiveSeo['robots'] => {
  const pageRobots = object(page.robots)
  const defaults = object(settings.defaultRobots)
  const pageMode = select(pageRobots.mode, ['inherit', 'index-follow', 'noindex-follow', 'index-nofollow', 'noindex-nofollow', 'custom'] as const) ?? 'inherit'
  // Legacy values are intentionally not interpreted: a page without the new explicit mode inherits.
  const configuredMode = pageMode === 'inherit'
    ? select(defaults.mode, ['index-follow', 'noindex-follow', 'index-nofollow', 'noindex-nofollow', 'custom'] as const) ?? 'index-follow'
    : pageMode
  const source = pageMode === 'inherit' ? defaults : pageRobots
  const custom = nonEmptyString(source.directives)?.split(',').map((value) => value.trim().toLowerCase()).filter(Boolean)
  const fallback = configuredMode === 'custom'
    ? { index: custom?.includes('noindex') ? 'noindex' : 'index', follow: custom?.includes('nofollow') ? 'nofollow' : 'follow' } as Required<SeoRobotsDirectives>
    : modeDirectives[configuredMode]
  return { mode: pageMode, ...fallback, ...(custom?.length ? { custom } : {}) }
}

export const resolveCanonical = async (input: Input, seo: SeoDocument): Promise<ResolvedEffectiveSeo['canonical']> => {
  const canonical = object(seo.canonical)
  const mode = select<CanonicalMode>(canonical.mode, ['auto', 'manual', 'none'] as const) ?? 'auto'
  if (mode === 'none') return { mode, external: false }
  const policy = input.config.url?.trailingSlash ?? 'never'
  if (mode === 'manual') {
    const url = normalizeCanonicalUrl(canonical.url, policy)
    if (!url) diagnostic(input, 'canonical', 'Manual canonical is invalid.')
    return { mode, url, external: Boolean(url && !isSameSiteUrl(input.settings.siteUrl, url)) }
  }
  try {
    const url = combineSiteUrl(input.settings.siteUrl, await input.config.resolveUrl({ collection: input.collection, document: input.document, locale: input.locale }), policy)
    if (!url) diagnostic(input, 'canonical', 'Automatic canonical could not resolve to a site URL.')
    return { mode, url, external: false }
  } catch {
    diagnostic(input, 'canonical', 'URL resolver failed while resolving canonical.')
    return { mode, external: false }
  }
}

const resolvePageSchema = async (input: Input, seo: SeoDocument, canonicalUrl?: string): Promise<Record<string, unknown> | undefined> => {
  const collection = input.config.collections[input.collection]
  if (!collection) return undefined
  const schema = object(seo.schema)
  const raw = nonEmptyString(schema.rawJson)
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (isPlainJsonObject(parsed)) return parsed
      diagnostic(input, 'schema', 'Raw schema must be a JSON object.')
    } catch {
      diagnostic(input, 'schema', 'Raw schema JSON could not be parsed.')
    }
    return undefined
  }
  return buildGeneratedSchema({ canonicalUrl, collectionSchema: collection.schema, defaultType: collection.schemaType, document: input.document, schema })
}

export const resolveStructuredData = async (input: Input, seo: SeoDocument, canonicalUrl?: string): Promise<{ schema?: Record<string, unknown>; siteSchemas: Record<string, unknown>[] }> => {
  const schema = await resolvePageSchema(input, seo, canonicalUrl)
  const organization = object(input.settings.organizationSchema)
  const siteUrl = normalizeSiteUrl(input.settings.siteUrl)
  const name = nonEmptyString(organization.name) ?? nonEmptyString(input.settings.siteName)
  const logo = await resolveImage(organization.logo, input)
  const sameAs = Array.isArray(organization.sameAs)
    ? organization.sameAs.map((value) => nonEmptyString(object(value).url) ?? nonEmptyString(value)).filter(isAbsoluteHttpUrl).map((value) => value.trim())
    : []
  const siteSchemas: Record<string, unknown>[] = []
  if (name || logo || sameAs.length) siteSchemas.push({ '@context': 'https://schema.org', '@type': 'Organization', ...(name ? { name } : {}), ...(siteUrl ? { url: normalizeCanonicalUrl(organization.url, input.config.url?.trailingSlash ?? 'never') ?? siteUrl } : {}), ...(logo ? { logo } : {}), ...(sameAs.length ? { sameAs } : {}) })
  if (siteUrl && nonEmptyString(input.settings.siteName)) siteSchemas.push({ '@context': 'https://schema.org', '@type': 'WebSite', url: siteUrl, name: nonEmptyString(input.settings.siteName)! })
  return { schema, siteSchemas }
}

export const resolveSocialMetadata = async (input: Input, seo: SeoDocument, title?: string, description?: string, canonicalUrl?: string): Promise<ResolvedEffectiveSeo['social']> => {
  const collection = input.config.collections[input.collection]
  const openGraph = object(seo.openGraph)
  const twitter = object(seo.twitter)
  const mappedImage = collection ? getByPath(input.document, collection.fields?.image) : undefined
  const ogImage = await resolveImage(openGraph.image ?? mappedImage ?? input.settings.defaultOpenGraphImage, input)
  const ogTitle = nonEmptyString(openGraph.title) ?? title
  const ogDescription = nonEmptyString(openGraph.description) ?? description
  const openGraphResult = {
    ...(ogTitle ? { title: ogTitle } : {}), ...(ogDescription ? { description: ogDescription } : {}), ...(ogImage ? { image: ogImage } : {}),
    ...(canonicalUrl ? { url: canonicalUrl } : {}), ...(nonEmptyString(input.settings.defaultOpenGraphType) ? { type: nonEmptyString(input.settings.defaultOpenGraphType) } : {}),
    ...(nonEmptyString(input.settings.siteName) ? { siteName: nonEmptyString(input.settings.siteName) } : {}),
    ...(nonEmptyString(input.settings.defaultLocale) ?? nonEmptyString(input.locale) ? { locale: nonEmptyString(input.settings.defaultLocale) ?? input.locale } : {}),
  }
  const twitterImage = await resolveImage(twitter.image, input) ?? ogImage
  const card = select(twitter.card, ['summary', 'summary_large_image'] as const) ?? select(input.settings.defaultTwitterCard, ['summary', 'summary_large_image'] as const)
  return {
    openGraph: openGraphResult,
    twitter: {
      ...(nonEmptyString(twitter.title) ?? ogTitle ? { title: nonEmptyString(twitter.title) ?? ogTitle } : {}),
      ...(nonEmptyString(twitter.description) ?? ogDescription ? { description: nonEmptyString(twitter.description) ?? ogDescription } : {}),
      ...(twitterImage ? { image: twitterImage } : {}), ...(card ? { card } : {}),
      ...(nonEmptyString(twitter.site) ?? nonEmptyString(input.settings.defaultTwitterSite) ? { site: nonEmptyString(twitter.site) ?? nonEmptyString(input.settings.defaultTwitterSite) } : {}),
      ...(nonEmptyString(twitter.creator) ?? nonEmptyString(input.settings.defaultTwitterCreator) ? { creator: nonEmptyString(twitter.creator) ?? nonEmptyString(input.settings.defaultTwitterCreator) } : {}),
    },
  }
}

/** The one resolver every SEO output consumes. It performs no Payload reads. */
export const resolveEffectiveSeo = async (input: Input): Promise<ResolvedEffectiveSeo> => {
  const collection = input.config.collections[input.collection]
  if (!collection) return { canonical: { mode: 'auto', external: false }, robots: { mode: 'inherit', index: 'index', follow: 'follow' }, social: { openGraph: {}, twitter: {} }, siteSchemas: [] }
  const seo = getSeoGroup(input.document, input.names?.seoField ?? 'seo')
  const sourceTitle = nonEmptyString(seo.title) ?? nonEmptyString(getByPath(input.document, collection.fields?.title))
  const title = sourceTitle && titleTemplate(input.settings.titleTemplate) ? titleTemplate(input.settings.titleTemplate)!.replace('%s', sourceTitle) : sourceTitle
  const description = nonEmptyString(seo.description) ?? nonEmptyString(getByPath(input.document, collection.fields?.description)) ?? nonEmptyString(input.settings.defaultDescription)
  const canonical = await resolveCanonical(input, seo)
  const robots = resolveEffectiveRobots(seo, input.settings)
  const social = await resolveSocialMetadata(input, seo, title, description, canonical.url)
  const structured = await resolveStructuredData(input, seo, canonical.url)
  return { ...(title ? { title } : {}), ...(description ? { description } : {}), canonical, robots, social, ...structured }
}

/** Shared sitemap decision: only published, non-deleted, indexable pages with a same-site canonical can be listed. */
export const resolveSitemapEligibility = async ({ effective, document, input }: { effective: ResolvedEffectiveSeo; document: SeoDocument; input: Input }): Promise<boolean> => {
  if (effective.robots.index === 'noindex' || effective.canonical.external || !effective.canonical.url) return false
  if (document._status !== undefined && document._status !== 'published') return false
  if (document._deleted === true || document.deletedAt) return false
  const exclude = input.config.collections[input.collection]?.sitemap?.exclude
  return exclude ? !(await exclude({ collection: input.collection, document, locale: input.locale, effective })) : true
}

export const projectSeoPreview = (effective: ResolvedEffectiveSeo): SeoPreview => ({
  ...(effective.title ? { title: effective.title } : {}),
  ...(effective.description ? { description: effective.description } : {}),
  ...(effective.canonical.url ? { canonicalUrl: effective.canonical.url } : {}),
  ...(effective.social.openGraph.image ?? effective.social.twitter.image ? { image: effective.social.openGraph.image ?? effective.social.twitter.image } : {}),
  robots: { index: effective.robots.index, follow: effective.robots.follow },
})
