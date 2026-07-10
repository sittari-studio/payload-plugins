import type { SeoDocument, SeoPayload } from '../types.js'
import { getSeoRuntimeConfig } from './config.js'
import { resolveSeoNames } from '../plugin.js'
import { resolveEffectiveSeo, resolveSitemapEligibility } from '../resolvers/effective.js'
import { isAbsoluteHttpUrl } from '../utils/validation.js'
import { isSameSiteUrl, normalizeCanonicalUrl } from '../utils/urls.js'

const PAGE_SIZE = 25_000
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

export const renderSitemapXml = async ({ payload, collection, locale, page }: { payload: SeoPayload; collection: string; locale: string; page: number }): Promise<string> => {
  const config = getSeoRuntimeConfig(payload)
  const collectionConfig = config?.collections[collection]
  if (!config || !payload.find || !collectionConfig || collectionConfig.sitemap?.enabled === false || !Number.isInteger(page) || page < 1) return empty()
  try {
    const names = resolveSeoNames(config.names)
    const settings = await payload.findGlobal({ slug: names.settingsGlobal, locale, fallbackLocale: false, draft: false })
    const select = sitemapSelect(collectionConfig.sitemap?.fields, names.seoField)
    const result = await payload.find({ collection, locale, fallbackLocale: false, draft: false, depth: 0, limit: PAGE_SIZE, page, ...(select ? { select } : {}) })
    const urls = await Promise.all(result.docs.map(async (document) => {
      const input = { collection, config, document, locale, names, settings }
      const effective = await resolveEffectiveSeo(input)
      if (!(await resolveSitemapEligibility({ effective, document, input }))) return null
      let lastmod = validDate(document.updatedAt)
      if (collectionConfig.lastModified) lastmod = validDate(await collectionConfig.lastModified({ collection, document, locale }))
      return `<url><loc>${escapeXml(effective.canonical.url!)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`
    }))
    return xmlDocument(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.filter((url): url is string => Boolean(url)).join('')}</urlset>`)
  } catch {
    config.diagnostics?.({ area: 'sitemap', collection, locale, message: 'Sitemap resolution failed.' })
    return empty()
  }
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
        const count = await payload.find({ collection, locale: locale || undefined, fallbackLocale: false, draft: false, depth: 0, limit: 0, pagination: false })
        for (let page = 1; page <= Math.ceil((count.totalDocs ?? 0) / PAGE_SIZE); page++) {
          const resolvedUrl = await config.resolveChunkUrl({ collection, locale, page })
          if (!isAbsoluteHttpUrl(resolvedUrl)) continue
          const url = resolvedUrl.trim()
          const normalizedUrl = isSameSiteUrl(config.siteUrl, url)
            ? normalizeCanonicalUrl(url, config.url?.trailingSlash ?? 'never')
            : url
          if (normalizedUrl) entries.push(`<sitemap><loc>${escapeXml(normalizedUrl)}</loc></sitemap>`)
        }
      } catch {
        config.diagnostics?.({ area: 'sitemap', collection, locale, message: 'Sitemap index chunk resolution failed.' })
      }
    }
  }
  return xmlDocument(`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.join('')}</sitemapindex>`)
}
