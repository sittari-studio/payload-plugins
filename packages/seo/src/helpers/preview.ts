import type { SeoDocument, SeoPayload, SeoPreview } from '../types.js'
import { resolveSeoNames } from '../plugin.js'
import { projectSeoPreview, resolveEffectiveSeo } from '../resolvers/effective.js'
import { loadDocumentWithoutFallback, loadSettingsWithoutFallback } from '../utils/locale.js'
import { getSeoRuntimeConfig } from './config.js'

type DocumentInput = { document: SeoDocument; id?: never } | { document?: never; id: string | number }

/** Server-backed preview projection with exactly the same resolution inputs as production metadata. */
export const resolveSeoPreview = async ({ payload, collection, locale, ...source }: {
  payload: SeoPayload
  collection: string
  locale: string
} & DocumentInput): Promise<SeoPreview> => {
  const config = getSeoRuntimeConfig(payload)
  if (!config?.collections[collection]) return { robots: { index: 'index', follow: 'follow' } }
  const names = resolveSeoNames(config.names)
  try {
    const document = 'id' in source
      ? await loadDocumentWithoutFallback({ payload, collection, id: source.id!, locale })
      : source.document
    const settings = await loadSettingsWithoutFallback({ payload, slug: names.settingsGlobal, locale })
    return projectSeoPreview(await resolveEffectiveSeo({ collection, config, document, locale, names, settings }))
  } catch {
    config.diagnostics?.({ area: 'metadata', collection, locale, message: 'Preview resolution failed.' })
    return { robots: { index: 'index', follow: 'follow' } }
  }
}
