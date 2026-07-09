import type { SeoDocument, SeoPayload } from '../types.js'
import { getSeoRuntimeConfig } from './config.js'
import { isAbsoluteHttpUrl } from '../utils/validation.js'
import { resolveSeoNames } from '../plugin.js'

const PAGE_SIZE = 25_000
const escapeXml = (value: string): string => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!)
const xmlDocument = (body: string): string => `<?xml version="1.0" encoding="UTF-8"?>\n${body}`
const validDate = (value: unknown): string | undefined => {
  const date = value instanceof Date ? value : typeof value === 'string' ? new Date(value) : undefined
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : undefined
}

const sitemapSelect = (fields: readonly string[] | undefined): Record<string, true> | undefined => {
  if (!fields?.length) return undefined
  return Object.fromEntries([...new Set(['updatedAt', ...fields])].map((field) => [field, true]))
}

export const renderSitemapXml = async ({ payload, collection, locale, page }: { payload: SeoPayload; collection: string; locale: string; page: number }): Promise<string> => {
  const config = getSeoRuntimeConfig(payload)
  const collectionConfig = config?.collections[collection]
  if (!config || !payload.find || !collectionConfig || collectionConfig.sitemap?.enabled === false || !Number.isInteger(page) || page < 1) return xmlDocument('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>')
  try {
    const settings = await payload.findGlobal({ slug: resolveSeoNames(config.names).settingsGlobal, locale, fallbackLocale: false, draft: false })
    const siteUrl = settings.siteUrl
    if (!isAbsoluteHttpUrl(siteUrl)) return xmlDocument('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>')
    const select = sitemapSelect(collectionConfig.sitemap?.fields)
    const result = await payload.find({
      collection,
      locale,
      fallbackLocale: false,
      draft: false,
      depth: 0,
      limit: PAGE_SIZE,
      page,
      ...(select ? { select } : {}),
    })
    const urls = await Promise.all(result.docs.map(async (document) => {
      try {
        const path = await config.resolveUrl({ collection, document, locale })
        if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || /[?#]/.test(path)) return null
        const loc = new URL(path, siteUrl).toString()
        let lastmod = validDate(document.updatedAt)
        if (collectionConfig.lastModified) lastmod = validDate(await collectionConfig.lastModified({ collection, document, locale }))
        return `<url><loc>${escapeXml(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`
      } catch { return null }
    }))
    return xmlDocument(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.filter((url): url is string => Boolean(url)).join('')}</urlset>`)
  } catch {
    return xmlDocument('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>')
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
          const url = await config.resolveChunkUrl({ collection, locale, page })
          if (isAbsoluteHttpUrl(url)) entries.push(`<sitemap><loc>${escapeXml(url.trim())}</loc></sitemap>`)
        }
      } catch { /* omit invalid collection-locale chunks */ }
    }
  }
  return xmlDocument(`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.join('')}</sitemapindex>`)
}
