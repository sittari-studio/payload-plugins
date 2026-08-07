import type { Payload } from 'payload'

import { getLocaleCodes, getPathRuntimeConfig } from './config.js'
import {
  PATH_REBUILD_CONTEXT_KEY,
  type RebuildDocumentPathsArgs,
  type RebuildDocumentPathsResult,
} from './types.js'

type RebuildInternalArgs = RebuildDocumentPathsArgs & {
  missingOnly?: boolean
}

const rebuildCollectionLocale = async ({
  batchSize,
  collection,
  draft,
  draftOnly,
  locale,
  missingOnly,
  payload,
}: {
  batchSize: number
  collection: string
  draft: boolean
  draftOnly: boolean
  locale?: string
  missingOnly: boolean
  payload: Payload
}): Promise<number> => {
  let updated = 0
  let page = 1
  const missingPath = {
    or: [
      { path: { exists: false } },
      { path: { equals: null } },
      { path: { equals: '' } },
    ],
  }
  const where = draftOnly
    ? {
        and: [
          ...(missingOnly ? [missingPath] : []),
          { _status: { not_equals: 'published' } },
        ],
      }
    : missingOnly
      ? missingPath
      : undefined

  while (true) {
    const result = await payload.find({
      collection: collection as never,
      depth: 0,
      draft,
      fallbackLocale: false,
      limit: batchSize,
      locale: locale as never,
      overrideAccess: true,
      page: missingOnly ? 1 : page,
      select: { _status: true, id: true } as never,
      where,
    })

    for (const document of result.docs as Array<{
      _status?: string
      id: number | string
    }>) {
      if (draftOnly && document._status === 'published') continue
      await payload.update({
        collection: collection as never,
        context: { [PATH_REBUILD_CONTEXT_KEY]: true },
        data: {},
        draft,
        fallbackLocale: false,
        id: document.id,
        locale: locale as never,
        overrideAccess: true,
      })
      updated += 1
    }

    if (!result.hasNextPage) break
    if (!missingOnly) page += 1
  }

  return updated
}

export const rebuildDocumentPathsWithPayload = async (
  payload: Payload,
  args: RebuildInternalArgs = {},
): Promise<RebuildDocumentPathsResult> => {
  const runtime = getPathRuntimeConfig(payload)
  if (!runtime) {
    throw new Error(
      '@sittari/payload-path-field: pathFieldPlugin is not configured on this Payload instance.',
    )
  }

  const batchSize = args.batchSize ?? 100
  if (!Number.isSafeInteger(batchSize) || batchSize < 1) {
    throw new Error(
      '@sittari/payload-path-field: batchSize must be a positive safe integer.',
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

  const locales = getLocaleCodes(payload.config as never)
  const localeValues: Array<string | undefined> =
    locales.length > 0 ? locales : [undefined]
  let updated = 0

  for (const collection of collections) {
    const collectionConfig = payload.config.collections.find(
      (candidate) => candidate.slug === collection,
    )
    const drafts = Boolean(collectionConfig?.versions?.drafts)
    for (const locale of localeValues) {
      updated += await rebuildCollectionLocale({
        batchSize,
        collection,
        draft: false,
        draftOnly: false,
        locale,
        missingOnly: args.missingOnly ?? false,
        payload,
      })
      if (drafts) {
        updated += await rebuildCollectionLocale({
          batchSize,
          collection,
          draft: true,
          draftOnly: true,
          locale,
          missingOnly: args.missingOnly ?? false,
          payload,
        })
      }
    }
  }

  return { updated }
}
