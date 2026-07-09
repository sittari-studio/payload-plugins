import type { ResolvedSeoMetadata, SeoDocument, SeoPayload } from '../types.js'
import { resolveSeoNames } from '../plugin.js'
import { resolveSeoMetadataCore } from '../resolvers/metadata.js'
import { loadDocumentWithoutFallback, loadSettingsWithoutFallback } from '../utils/locale.js'
import { combineSiteUrl } from '../utils/urls.js'
import { getSeoRuntimeConfig } from './config.js'

type DocumentInput = { document: SeoDocument; id?: never } | { document?: never; id: string | number }

const getLocales = (payload: SeoPayload, activeLocale: string): string[] => {
  const configured = payload.config?.localization?.locales ?? []
  const locales = configured.map((locale) => typeof locale === 'string' ? locale : locale.code).filter((locale): locale is string => Boolean(locale))
  return [...new Set([activeLocale, ...locales])]
}

export const resolveSeoMetadata = async ({ payload, collection, locale, ...input }: {
  payload: SeoPayload
  collection: string
  locale: string
} & DocumentInput): Promise<ResolvedSeoMetadata> => {
  const config = getSeoRuntimeConfig(payload)
  if (!config?.collections[collection]) return {}
  const names = resolveSeoNames(config.names)
  let document: SeoDocument
  try {
    document = 'id' in input ? await loadDocumentWithoutFallback({ payload, collection, id: input.id!, locale }) : input.document
    const settings = await loadSettingsWithoutFallback({ payload, slug: names.settingsGlobal, locale })
    const result = await resolveSeoMetadataCore({ collection, config, document, locale, names, settings })
    const id = document.id
    if (typeof id !== 'string' && typeof id !== 'number') return result
    const alternates: Record<string, string> = {}
    for (const alternateLocale of getLocales(payload, locale)) {
      try {
        const alternateDocument = alternateLocale === locale ? document : await loadDocumentWithoutFallback({ payload, collection, id, locale: alternateLocale })
        const path = await config.resolveUrl({ collection, document: alternateDocument, locale: alternateLocale })
        const url = combineSiteUrl(settings.siteUrl, path)
        if (url) alternates[alternateLocale] = url
      } catch { /* A missing locale-specific document is simply not an alternate. */ }
    }
    return Object.keys(alternates).length ? { ...result, alternates } : result
  } catch {
    return {}
  }
}
