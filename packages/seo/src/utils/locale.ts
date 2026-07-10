import type { SeoDocument, SeoLocalApiOptions, SeoPayload } from '../types.js'

/** Reads one document in exactly the requested locale, never Payload's fallback locale. */
export const loadDocumentWithoutFallback = async ({
  payload,
  collection,
  id,
  locale,
  access,
}: {
  payload: SeoPayload
  collection: string
  id: string | number
  locale: string
  access?: SeoLocalApiOptions
}): Promise<SeoDocument> =>
  payload.findByID({ collection, id, locale, fallbackLocale: false, draft: false, ...access })

/** Reads localized settings in exactly the requested locale. */
export const loadSettingsWithoutFallback = async ({
  payload,
  slug,
  locale,
  access,
}: {
  payload: SeoPayload
  slug: string
  locale: string
  access?: SeoLocalApiOptions
}): Promise<SeoDocument> =>
  payload.findGlobal({ slug, locale, fallbackLocale: false, draft: false, ...access })
