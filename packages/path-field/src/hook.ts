import type { CollectionBeforeChangeHook, PayloadRequest } from 'payload'

import { assertValidDocumentPath } from './path.js'
import type {
  PathCollectionOptions,
  ResolveDocumentUrl,
} from './types.js'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const valueForLocale = (
  value: unknown,
  locale: string,
  locales: Set<string>,
): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => valueForLocale(entry, locale, locales))
  }
  if (!isRecord(value)) return value

  const keys = Object.keys(value)
  if (keys.length > 0 && keys.every((key) => locales.has(key))) {
    return valueForLocale(value[locale], locale, locales)
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      valueForLocale(entry, locale, locales),
    ]),
  )
}

const getRelationshipID = (value: unknown): number | string | undefined => {
  if (typeof value === 'number' || typeof value === 'string') return value
  if (isRecord(value) && (typeof value.id === 'number' || typeof value.id === 'string')) {
    return value.id
  }
  return undefined
}

const populateParent = async ({
  collection,
  doc,
  locale,
  options,
  req,
}: {
  collection: string
  doc: Record<string, unknown>
  locale?: string
  options: PathCollectionOptions
  req: PayloadRequest
}): Promise<Record<string, unknown>> => {
  if (!options.parentField) return doc
  const parentID = getRelationshipID(doc[options.parentField])
  if (parentID === undefined) return doc

  const parent = await req.payload.findByID({
    collection: collection as never,
    depth: 1,
    fallbackLocale: false,
    id: parentID,
    locale: locale as never,
    overrideAccess: true,
    req,
  })
  return { ...doc, [options.parentField]: parent }
}

const resolveForLocale = async ({
  collection,
  data,
  locale,
  locales,
  options,
  originalDoc,
  req,
  resolver,
}: {
  collection: string
  data: Record<string, unknown>
  locale?: string
  locales: Set<string>
  options: PathCollectionOptions
  originalDoc?: Record<string, unknown>
  req: PayloadRequest
  resolver: ResolveDocumentUrl
}): Promise<string> => {
  const localizedOriginal = locale
    ? (valueForLocale(originalDoc ?? {}, locale, locales) as Record<string, unknown>)
    : (originalDoc ?? {})
  const localizedData = locale
    ? (valueForLocale(data, locale, locales) as Record<string, unknown>)
    : data
  const effective = { ...localizedOriginal, ...localizedData }
  delete effective.path

  const doc = await populateParent({
    collection,
    doc: effective,
    locale,
    options,
    req,
  })
  const path = await resolver({
    collection,
    doc,
    locale,
    payload: req.payload,
    req,
  })
  assertValidDocumentPath(path)
  return path
}

export const createPathBeforeChangeHook = ({
  collection,
  defaultLocale,
  localeCodes,
  options,
  resolver,
}: {
  collection: string
  defaultLocale?: string
  localeCodes: string[]
  options: PathCollectionOptions
  resolver: ResolveDocumentUrl
}): CollectionBeforeChangeHook => {
  const locales = new Set(localeCodes)

  return async ({ data, originalDoc, req }) => {
    const requestLocale = (req as PayloadRequest & { locale?: string }).locale

    if (requestLocale === 'all') {
      const paths: Record<string, string> = {}
      for (const locale of localeCodes) {
        paths[locale] = await resolveForLocale({
          collection,
          data,
          locale,
          locales,
          options,
          originalDoc,
          req,
          resolver,
        })
      }
      return { ...data, path: paths }
    }

    const locale = localeCodes.length > 0
      ? (requestLocale ?? defaultLocale)
      : undefined
    const path = await resolveForLocale({
      collection,
      data,
      locale,
      locales,
      options,
      originalDoc,
      req,
      resolver,
    })
    return { ...data, path }
  }
}
