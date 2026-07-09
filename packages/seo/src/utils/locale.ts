import type { SeoDocument, SeoPayload } from '../types.js'

/** Reads one document in exactly the requested locale, never Payload's fallback locale. */
export const loadDocumentWithoutFallback = async ({
  payload,
  collection,
  id,
  locale,
}: {
  payload: SeoPayload
  collection: string
  id: string | number
  locale: string
}): Promise<SeoDocument> =>
  payload.findByID({ collection, id, locale, fallbackLocale: false, draft: false })

/** Reads localized settings in exactly the requested locale. */
export const loadSettingsWithoutFallback = async ({
  payload,
  slug,
  locale,
}: {
  payload: SeoPayload
  slug: string
  locale: string
}): Promise<SeoDocument> =>
  payload.findGlobal({ slug, locale, fallbackLocale: false, draft: false })
