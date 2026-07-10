import type { SeoDocument, SeoPayload } from '../types.js'
import { resolveSeoNames } from '../plugin.js'
import { resolveCanonicalRobotsSeo, resolveSitemapEligibility } from '../resolvers/effective.js'
import { isAbsoluteHttpUrl } from '../utils/validation.js'
import { isSameSiteUrl, normalizeCanonicalUrl } from '../utils/urls.js'
import { getSeoRuntimeConfig } from './config.js'
import { resolveSeoAlternates } from './metadata.js'

const PAGE_SIZE = 25_000
const RESOLUTION_CONCURRENCY = 16
const escapeXml = (value: string): string => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!)
const xmlDocument = (body: string): string => `<?xml version="1.0" encoding="UTF-8"?>\n${body}`
const empty = (): string => xmlDocument('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>')
const validDate = (value: unknown): string | undefined => {
  const date = value instanceof Date ? value : typeof value === 'string' ? new Date(value) : undefined
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : undefined
}

const sitemapSelect = (fields: readonly string[] | undefined, seoField: string): Record<string, true> | undefined => {
  if (!fields?.length) return undefined
  return Object.fromEntries([...new Set(['updatedAt', '_status', 'deletedAt', '_deleted', seoField, ...fields])].map((field) => [field, true]))
}

type SitemapEntry = { alternates: Record<string, string>; lastmod?: string; url: string }

/**
 * Resolves the complete locale dataset before slicing it into chunks. Collisions
 * are keyed by the final normalized canonical URL; the first eligible document
 * in Payload's stable query order wins.
 */
const resolveSitemapEntries = async ({ payload, collection, locale }: { payload: SeoPayload; collection: string; locale: string }): Promise<SitemapEntry[]> => {
  const config = getSeoRuntimeConfig(payload)
  const collectionConfig = config?.collections[collection]
  if (!config || !payload.find || !collectionConfig || collectionConfig.sitemap?.enabled === false) return []
  const names = resolveSeoNames(config.names)
  const settings = await payload.findGlobal({ slug: names.settingsGlobal, locale, fallbackLocale: false, draft: false })
  const select = sitemapSelect(collectionConfig.sitemap?.fields, names.seoField)
  const count = await payload.find({ collection, locale, fallbackLocale: false, draft: false, depth: 0, limit: 0, pagination: false })
  const entries: SitemapEntry[] = []
  const seen = new Set<string>()
  for (let rawPage = 1; rawPage <= Math.ceil((count.totalDocs ?? 0) / PAGE_SIZE); rawPage++) {
    const result = await payload.find({ collection, locale, fallbackLocale: false, draft: false, depth: 0, limit: PAGE_SIZE, page: rawPage, ...(select ? { select } : {}) })
    const resolved = await mapBounded(result.docs, RESOLUTION_CONCURRENCY, async (document) => {
      try {
        const input = { collection, config, document, locale, names, settings }
        const effective = await resolveCanonicalRobotsSeo(input)
        if (!(await resolveSitemapEligibility({ effective, document, input }))) return null
        const url = normalizeCanonicalUrl(effective.canonical.url, config.url?.trailingSlash ?? 'never')
        if (!url) return null
        let lastmod = validDate(document.updatedAt)
        if (collectionConfig.lastModified) lastmod = validDate(await collectionConfig.lastModified({ collection, document, locale }))
        return { url, ...(lastmod ? { lastmod } : {}), alternates: await resolveSeoAlternates({ payload, collection, locale, document, config, names, settings }) }
      } catch {
        config.diagnostics?.({ area: 'sitemap', collection, documentId: typeof document.id === 'string' || typeof document.id === 'number' ? document.id : undefined, locale, message: 'Sitemap document resolution failed.' })
        return null
      }
    })
    for (const entry of resolved) {
      if (!entry) continue
      if (seen.has(entry.url)) {
        config.diagnostics?.({ area: 'sitemap', collection, locale, message: 'Sitemap canonical collision omitted.' })
        continue
      }
      seen.add(entry.url)
      entries.push(entry)
    }
  }
  return entries
}

const renderEntry = (entry: SitemapEntry): string => {
  const alternates = Object.entries(entry.alternates).map(([locale, url]) => `<xhtml:link rel="alternate" hreflang="${escapeXml(locale)}" href="${escapeXml(url)}"/>`).join('')
  return `<url><loc>${escapeXml(entry.url)}</loc>${entry.lastmod ? `<lastmod>${entry.lastmod}</lastmod>` : ''}${alternates}</url>`
}

export const renderSitemapXml = async ({ payload, collection, locale, page }: { payload: SeoPayload; collection: string; locale: string; page: number }): Promise<string> => {
  if (!Number.isInteger(page) || page < 1) return empty()
  try {
    const entries = await resolveSitemapEntries({ payload, collection, locale })
    const chunk = entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    const xhtml = chunk.some((entry) => Object.keys(entry.alternates).length)
    return xmlDocument(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${xhtml ? ' xmlns:xhtml="http://www.w3.org/1999/xhtml"' : ''}>${chunk.map(renderEntry).join('')}</urlset>`)
  } catch {
    const config = getSeoRuntimeConfig(payload)
    config?.diagnostics?.({ area: 'sitemap', collection, locale, message: 'Sitemap resolution failed.' })
    return empty()
  }
}

const mapBounded = async <T, R>(items: readonly T[], concurrency: number, mapper: (item: T) => Promise<R>): Promise<R[]> => {
  const results = new Array<R>(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await mapper(items[index]!)
    }
  }))
  return results
}

export const renderSitemapIndexXml = async ({ payload }: { payload: SeoPayload }): Promise<string> => {
  const config = getSeoRuntimeConfig(payload)
  if (!config || !payload.find) return xmlDocument('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>')
  const locales = payload.config?.localization?.locales?.map((locale) => typeof locale === 'string' ? locale : locale.code).filter((locale): locale is string => Boolean(locale)) ?? []
  const effectiveLocales = locales.length ? locales : ['']
  const entries: string[] = []
  for (const [collection, collectionConfig] of Object.entries(config.collections)) {
    if (collectionConfig.sitemap?.enabled === false) continue
    for (const locale of effectiveLocales) {
      try {
        const count = (await resolveSitemapEntries({ payload, collection, locale })).length
        for (let page = 1; page <= Math.ceil(count / PAGE_SIZE); page++) {
          const resolvedUrl = await config.resolveChunkUrl({ collection, locale, page })
          if (!isAbsoluteHttpUrl(resolvedUrl)) continue
          const url = resolvedUrl.trim()
          const normalizedUrl = isSameSiteUrl(config.siteUrl, url) ? normalizeCanonicalUrl(url, config.url?.trailingSlash ?? 'never') : url
          if (normalizedUrl) entries.push(`<sitemap><loc>${escapeXml(normalizedUrl)}</loc></sitemap>`)
        }
      } catch {
        config.diagnostics?.({ area: 'sitemap', collection, locale, message: 'Sitemap index chunk resolution failed.' })
      }
    }
  }
  return xmlDocument(`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.join('')}</sitemapindex>`)
}
