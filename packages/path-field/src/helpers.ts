import type { Payload } from 'payload'

import { getPathRuntimeConfig } from './config.js'
import { buildPaginatedPath, parsePaginatedPath } from './pagination.js'
import {
  cleanPathSegment,
  isValidDocumentPath,
  joinPathSegments,
  validateDocumentPath,
} from './path.js'
import { rebuildDocumentPathsWithPayload } from './rebuild.js'
import type {
  FindDocumentByPathArgs,
  FoundDocumentByPath,
  PathHelpers,
  PathLookupQueryOptions,
} from './types.js'

export type CreatePathHelpersArgs = {
  getPayload: () => Payload | Promise<Payload>
}

const findExact = async ({
  args,
  collections,
  path,
  payload,
}: {
  args: FindDocumentByPathArgs
  collections: string[]
  path: string
  payload: Payload
}): Promise<FoundDocumentByPath | null> => {
  const {
    collection: _collection,
    locale,
    pagination: _pagination,
    path: _path,
    ...queryOptions
  } = args
  const matches: FoundDocumentByPath[] = []

  for (const collection of collections) {
    const result = await payload.find({
      ...(queryOptions as PathLookupQueryOptions),
      collection: collection as never,
      draft: queryOptions.draft ?? false,
      fallbackLocale:
        'fallbackLocale' in queryOptions
          ? queryOptions.fallbackLocale
          : false,
      limit: 2,
      locale: locale as never,
      overrideAccess: queryOptions.overrideAccess ?? false,
      pagination: false,
      where: { path: { equals: path } },
    } as never)
    for (const document of result.docs as Record<string, unknown>[]) {
      matches.push({ collection, document })
    }
  }

  if (matches.length > 1) {
    throw new Error(
      `@sittari/payload-path-field: path "${path}" is ambiguous across enabled collections.`,
    )
  }
  return matches[0] ?? null
}

export const createPathHelpers = ({
  getPayload,
}: CreatePathHelpersArgs): PathHelpers => ({
  buildPaginatedPath,
  cleanPathSegment,
  isValidDocumentPath,
  joinPathSegments,
  parsePaginatedPath,
  validateDocumentPath,

  findDocumentByPath: async (args) => {
    if (!isValidDocumentPath(args.path)) return null
    const payload = await getPayload()
    const runtime = getPathRuntimeConfig(payload)
    if (!runtime) {
      throw new Error(
        '@sittari/payload-path-field: pathFieldPlugin is not configured on this Payload instance.',
      )
    }
    if (payload.config.localization && !args.locale) {
      throw new Error(
        '@sittari/payload-path-field: locale is required for localized path lookup.',
      )
    }

    const collections = args.collection
      ? [args.collection]
      : Object.keys(runtime.collections)
    for (const collection of collections) {
      if (!runtime.collections[collection]) {
        throw new Error(
          `@sittari/payload-path-field: collection "${collection}" is not enabled.`,
        )
      }
    }

    const exact = await findExact({
      args,
      collections,
      path: args.path,
      payload,
    })
    if (exact) {
      return args.pagination
        ? {
            ...exact,
            route: {
              canonicalPath: args.path,
              isCanonical: true,
              page: 1,
            },
          }
        : exact
    }
    if (!args.pagination) return null

    const parsed = parsePaginatedPath(args.path)
    if (!parsed) return null
    const base = await findExact({
      args,
      collections,
      path: parsed.basePath,
      payload,
    })
    if (!base) return null
    return {
      ...base,
      route: {
        canonicalPath: parsed.canonicalPath,
        isCanonical: parsed.isCanonical,
        page: parsed.page,
      },
    }
  },

  rebuildDocumentPaths: async (args) =>
    rebuildDocumentPathsWithPayload(await getPayload(), args),
})
