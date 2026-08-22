import { ValidationError, type Payload, type Where } from 'payload'

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
  draftStatus,
  locale,
  missingOnly,
  payload,
}: {
  batchSize: number
  collection: string
  draftStatus?: 'draft' | 'published'
  locale?: string
  missingOnly: boolean
  payload: Payload
}): Promise<number> => {
  const skippedDocumentIds: Array<number | string> = []
  let updated = 0
  let page = 1
  const missingPath: Where = {
    or: [
      { path: { exists: false } },
      { path: { equals: null } },
      { path: { equals: '' } },
    ],
  }

  while (true) {
    const constraints: Where[] = [
      ...(missingOnly ? [missingPath] : []),
      ...(draftStatus === 'published'
        ? [{ _status: { equals: 'published' } }]
        : draftStatus === 'draft'
          ? [{ _status: { not_equals: 'published' } }]
          : []),
      ...(missingOnly && skippedDocumentIds.length > 0
        ? [{ id: { not_in: skippedDocumentIds } }]
        : []),
    ]
    const where =
      constraints.length === 0
        ? undefined
        : constraints.length === 1
          ? constraints[0]
          : { and: constraints }
    const result = await payload.find({
      collection: collection as never,
      depth: 0,
      draft: draftStatus !== undefined,
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
      try {
        await payload.update({
          collection: collection as never,
          context: { [PATH_REBUILD_CONTEXT_KEY]: true },
          data: {},
          draft: draftStatus === 'draft',
          fallbackLocale: false,
          id: document.id,
          locale: locale as never,
          overrideAccess: true,
        })
        updated += 1
      } catch (error) {
        if (!(error instanceof ValidationError)) throw error

        skippedDocumentIds.push(document.id)
        payload.logger.error({
          collection,
          documentID: document.id,
          draft: draftStatus === 'draft',
          err: error,
          locale: locale ?? null,
          msg: '@sittari/payload-path-field: skipped rebuilding a missing document path because document validation failed.',
        })
      }
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
        draftStatus: drafts ? 'published' : undefined,
        locale,
        missingOnly: args.missingOnly ?? false,
        payload,
      })
      if (drafts) {
        updated += await rebuildCollectionLocale({
          batchSize,
          collection,
          draftStatus: 'draft',
          locale,
          missingOnly: args.missingOnly ?? false,
          payload,
        })
      }
    }
  }

  return { updated }
}
