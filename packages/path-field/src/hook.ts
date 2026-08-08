import {
  ValidationError,
  type CollectionBeforeChangeHook,
  type CollectionBeforeOperationHook,
  type PayloadRequest,
} from 'payload'

import { validateDocumentPath } from './path.js'
import type {
  PathCollectionOptions,
  ResolveDocumentUrl,
} from './types.js'
import {
  PATH_ALLOW_UNRESOLVED_CONTEXT_KEY,
  PATH_REBUILD_CONTEXT_KEY,
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

const assertResolvedDocumentPath: (
  path: unknown,
  collection: string,
  req: PayloadRequest,
) => asserts path is string = (path, collection, req) => {
  const validationResult = validateDocumentPath(path)
  if (validationResult !== true) {
    throw new ValidationError({
      collection,
      errors: [
        {
          message: validationResult,
          path: 'path',
        },
      ],
      req,
    })
  }
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

export const markPathUnresolvedOperation: CollectionBeforeOperationHook = ({
  args,
  operation,
}) => {
  const isPublishing =
    'data' in args &&
    isRecord(args.data) &&
    (args.data as Record<string, unknown>)._status === 'published'
  const allowsUnresolved =
    (operation === 'create' || operation === 'update') &&
    !isPublishing &&
    (
      ('autosave' in args && args.autosave === true) ||
      ('draft' in args && args.draft === true)
    )

  if (allowsUnresolved) {
    args.req.context[PATH_ALLOW_UNRESOLVED_CONTEXT_KEY] = true
  }
  return args
}

const resolveForLocale = async ({
  collection,
  data,
  allowUnresolved,
  locale,
  locales,
  options,
  originalDoc,
  req,
  resolver,
}: {
  collection: string
  data: Record<string, unknown>
  allowUnresolved: boolean
  locale?: string
  locales: Set<string>
  options: PathCollectionOptions
  originalDoc?: Record<string, unknown>
  req: PayloadRequest
  resolver: ResolveDocumentUrl
}): Promise<null | string> => {
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
  if (path === null && allowUnresolved) return null
  assertResolvedDocumentPath(path, collection, req)
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

  return async ({ context, data, operation, originalDoc, req }) => {
    const requestLocale = (req as PayloadRequest & { locale?: string }).locale
    const allowUnresolved =
      context[PATH_ALLOW_UNRESOLVED_CONTEXT_KEY] === true ||
      context[PATH_REBUILD_CONTEXT_KEY] === true

    if (requestLocale === 'all') {
      const paths: Record<string, null | string> = {}
      for (const locale of localeCodes) {
        paths[locale] = await resolveForLocale({
          collection,
          data,
          allowUnresolved,
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
      allowUnresolved,
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
