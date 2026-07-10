import type {
  CanonicalMode,
  ResolvedEffectiveSeo,
  ResolvedSitemapSeo,
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
import { normalizeRobotsDirectives } from '../utils/robots.js'

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

const modeDirectives: Record<Exclude<RobotsMode, 'inherit' | 'custom'>, Pick<ResolvedEffectiveSeo['robots'], 'index' | 'follow'>> = {
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
  const custom = normalizeRobotsDirectives(source.directives)
  const fallback: Pick<ResolvedEffectiveSeo['robots'], 'index' | 'follow'> = configuredMode === 'custom'
    ? { index: custom.includes('noindex') ? 'noindex' : 'index', follow: custom.includes('nofollow') ? 'nofollow' : 'follow' }
    : modeDirectives[configuredMode]
  return { mode: pageMode, ...fallback, ...(custom.length ? { custom } : {}) }
}

export const resolveCanonical = async (input: Input, seo: SeoDocument): Promise<ResolvedEffectiveSeo['canonical']> => {
  const canonical = object(seo.canonical)
  const mode = select<CanonicalMode>(canonical.mode, ['auto', 'manual', 'none'] as const) ?? 'auto'
  if (mode === 'none') return { mode, external: false }
  const policy = input.config.url?.trailingSlash ?? 'never'
  if (mode === 'manual') {
    const url = normalizeCanonicalUrl(canonical.url, policy)
    if (!url) diagnostic(input, 'canonical', 'Manual canonical is invalid.')
    return { mode, url, external: Boolean(url && !isSameSiteUrl(input.config.siteUrl, url)) }
  }
  try {
    const url = combineSiteUrl(input.config.siteUrl, await input.config.resolveUrl({ collection: input.collection, document: input.document, locale: input.locale }), policy)
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
  const generated = buildGeneratedSchema({ canonicalUrl, collectionSchema: collection.schema, defaultType: collection.schemaType, document: input.document, schema })
  const image = generated.image
  if (image !== undefined) {
    if (isAbsoluteHttpUrl(image)) generated.image = image.trim()
    else {
      const resolved = await resolveImage(image, input)
      if (resolved) generated.image = resolved
      else delete generated.image
    }
  }
  return generated
}

const resolveBreadcrumbs = async (input: Input, canonicalUrl?: string): Promise<Record<string, unknown>[]> => {
  const resolver = input.config.collections[input.collection]?.breadcrumbs
  if (!resolver) return []
  try {
    const items = await resolver({ collection: input.collection, document: input.document, locale: input.locale, canonicalUrl })
    const policy = input.config.url?.trailingSlash ?? 'never'
    const itemListElement = items.flatMap((item, position) => {
      const name = nonEmptyString(item?.name)
      const url = isAbsoluteHttpUrl(item?.url)
        ? normalizeCanonicalUrl(item.url, policy)
        : combineSiteUrl(input.config.siteUrl, item?.url, policy)
      return name && url ? [{ '@type': 'ListItem', position: position + 1, name, item: url }] : []
    })
    return itemListElement.length ? [{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement }] : []
  } catch {
    diagnostic(input, 'schema', 'Breadcrumb resolver failed.')
    return []
  }
}

export const resolveStructuredData = async (input: Input, seo: SeoDocument, canonicalUrl?: string): Promise<{ schema?: Record<string, unknown>; siteSchemas: Record<string, unknown>[]; breadcrumbs: Record<string, unknown>[] }> => {
  const schema = await resolvePageSchema(input, seo, canonicalUrl)
  const organization = object(input.settings.organizationSchema)
  const siteUrl = normalizeSiteUrl(input.config.siteUrl)
  const name = nonEmptyString(organization.name) ?? nonEmptyString(input.settings.siteName)
  const logo = await resolveImage(organization.logo, input)
  const sameAs = Array.isArray(organization.sameAs)
    ? organization.sameAs.map((value) => nonEmptyString(object(value).url) ?? nonEmptyString(value)).filter(isAbsoluteHttpUrl).map((value) => value.trim())
    : []
  const siteSchemas: Record<string, unknown>[] = []
  if (name || logo || sameAs.length) siteSchemas.push({ '@context': 'https://schema.org', '@type': 'Organization', ...(name ? { name } : {}), ...(siteUrl ? { url: normalizeCanonicalUrl(organization.url, input.config.url?.trailingSlash ?? 'never') ?? siteUrl } : {}), ...(logo ? { logo } : {}), ...(sameAs.length ? { sameAs } : {}) })
  if (siteUrl && nonEmptyString(input.settings.siteName)) siteSchemas.push({ '@context': 'https://schema.org', '@type': 'WebSite', url: siteUrl, name: nonEmptyString(input.settings.siteName)! })
  return { schema, siteSchemas, breadcrumbs: await resolveBreadcrumbs(input, canonicalUrl) }
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
  if (!collection) return { canonical: { mode: 'auto', external: false }, robots: { mode: 'inherit', index: 'index', follow: 'follow' }, social: { openGraph: {}, twitter: {} }, siteSchemas: [], breadcrumbs: [] }
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

/** Lightweight shared decision for sitemap and hreflang eligibility. */
export const resolveCanonicalRobotsSeo = async (input: Input): Promise<ResolvedSitemapSeo> => {
  const seo = getSeoGroup(input.document, input.names?.seoField ?? 'seo')
  return { canonical: await resolveCanonical(input, seo), robots: resolveEffectiveRobots(seo, input.settings) }
}

export const isPublicSeoDocument = (document: SeoDocument): boolean =>
  !(document._status !== undefined && document._status !== 'published')
  && document._deleted !== true
  && !document.deletedAt

/** Shared sitemap decision: only published, non-deleted, indexable pages with a same-site canonical can be listed. */
export const resolveSitemapEligibility = async ({ effective, document, input }: { effective: ResolvedSitemapSeo; document: SeoDocument; input: Input }): Promise<boolean> => {
  if (effective.robots.index === 'noindex' || effective.canonical.external || !effective.canonical.url) return false
  if (!isPublicSeoDocument(document)) return false
  const exclude = input.config.collections[input.collection]?.sitemap?.exclude
  return exclude ? !(await exclude({ collection: input.collection, document, locale: input.locale, effective })) : true
}

export const projectSeoPreview = (effective: ResolvedEffectiveSeo): SeoPreview => ({
  ...(effective.title ? { title: effective.title } : {}),
  ...(effective.description ? { description: effective.description } : {}),
  ...(effective.canonical.url ? { canonicalUrl: effective.canonical.url } : {}),
  ...(effective.social.openGraph.image ?? effective.social.twitter.image ? { image: effective.social.openGraph.image ?? effective.social.twitter.image } : {}),
  ...(Object.keys(effective.social.openGraph).length ? { openGraph: effective.social.openGraph } : {}),
  robots: { index: effective.robots.index, follow: effective.robots.follow },
  ...(effective.schema || effective.siteSchemas.length || effective.breadcrumbs.length ? {
    schema: effective.siteSchemas.length || effective.breadcrumbs.length
      ? { '@context': 'https://schema.org', '@graph': [...(effective.schema ? [effective.schema] : []), ...effective.breadcrumbs, ...effective.siteSchemas] }
      : effective.schema,
  } : {}),
  ...(Object.keys(effective.social.twitter).length ? { twitter: effective.social.twitter } : {}),
})
