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
import { combineSiteUrl, isSameSiteUrl, nonEmptyString, normalizeCanonicalUrl } from '../utils/urls.js'
import { isAbsoluteHttpUrl } from '../utils/validation.js'
import { normalizeRobotsDirectives } from '../utils/robots.js'
import { composeSchemaGraph, resolveSchemaList } from '../schema/resolve.js'
import { isJsonObject } from '../schema/json.js'
import type { JsonObject, SeoCollectionSchemaTemplates, SeoDocumentSchema, SeoGlobalSchemaOverride, SeoSchemaInstance, SeoSchemaTemplate } from '../schema/types.js'

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

const schemaObject = (value: unknown): JsonObject | undefined => {
  if (isJsonObject(value)) return value
  if (typeof value === 'string') try { const parsed: unknown = JSON.parse(value); return isJsonObject(parsed) ? parsed : undefined } catch { return undefined }
  return undefined
}

const template = (value: unknown): SeoSchemaTemplate | undefined => {
  if (!isJsonObject(value)) return undefined
  const id = value.templateId ?? value.schemaId ?? value.id
  const schema = schemaObject(value.schema)
  return typeof id === 'string' && typeof value.name === 'string' && schema
    ? { id, name: value.name, schema, ...(Array.isArray(value.valueOverrides) ? { valueOverrides: value.valueOverrides as SeoSchemaTemplate['valueOverrides'] } : {}), ...(value.isDefault === true ? { isDefault: true } : {}) }
    : undefined
}

export const resolveStructuredData = async (input: Input, seo: SeoDocument, canonicalUrl?: string): Promise<{ schemas: JsonObject[] }> => {
  const parseTemplates = (items: unknown, scope: 'Collection' | 'Document' | 'Global'): SeoSchemaTemplate[] => Array.isArray(items) ? items.flatMap((item) => {
    const parsed = template(item)
    if (parsed) return [parsed]
    const id = isJsonObject(item) && typeof (item.templateId ?? item.schemaId ?? item.id) === 'string' ? String(item.templateId ?? item.schemaId ?? item.id) : 'unknown'
    diagnostic(input, 'schema', `${scope} schema "${id}" is invalid and was omitted.`)
    return []
  }) : []
  const globalSchemas = parseTemplates(input.settings.globalSchemas, 'Global')
  const groups = Array.isArray(input.settings.collectionSchemas) ? input.settings.collectionSchemas as SeoCollectionSchemaTemplates[] : []
  const group = groups.find((item) => item && item.collection === input.collection)
  const templates = parseTemplates(group?.templates, 'Collection')
  const instances = Array.isArray(seo.schemaInstances) ? seo.schemaInstances as SeoSchemaInstance[] : []
  const documentSchemas = parseTemplates(seo.documentSchemas, 'Document').map(({ id, name, schema, valueOverrides }) => ({ schemaId: id, name, schema, valueOverrides }) satisfies SeoDocumentSchema)
  const globalOverrides = Array.isArray(seo.globalSchemaOverrides) ? seo.globalSchemaOverrides as SeoGlobalSchemaOverride[] : []
  return { schemas: resolveSchemaList({
    globalSchemas, globalOverrides, templates, instances, documentSchemas, document: input.document, canonicalUrl,
    onError: ({ id, reason, scope }) => diagnostic(input, 'schema', `${scope === 'global' ? 'Global' : scope === 'document' ? 'Document' : 'Collection'} schema "${id}" is ${reason === 'missing' ? 'missing' : 'invalid'} and was omitted.`),
  }) }
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
  if (!collection) return { canonical: { mode: 'auto', external: false }, robots: { mode: 'inherit', index: 'index', follow: 'follow' }, social: { openGraph: {}, twitter: {} }, schemas: [] }
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
  ...(effective.schemas.length ? { schema: composeSchemaGraph(effective.schemas) } : {}),
  ...(Object.keys(effective.social.twitter).length ? { twitter: effective.social.twitter } : {}),
})
