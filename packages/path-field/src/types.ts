import type {
  CollectionBeforeChangeHook,
  Config,
  Payload,
  PayloadRequest,
  SelectType,
  Where,
} from 'payload'

export type PathCollectionOptions = {
  parentField?: string
}

export type PathFieldPluginConfig = {
  collections: Record<string, boolean | PathCollectionOptions>
  enabled?: boolean
  resolveDocumentUrl: ResolveDocumentUrl
}

export type ResolveDocumentUrlArgs = {
  collection: string
  doc: Record<string, unknown>
  locale?: string
  payload: Payload
  req: PayloadRequest
}

export type ResolveDocumentUrl = (
  args: ResolveDocumentUrlArgs,
) => Promise<null | string> | null | string

export type PathFieldRuntimeConfig = {
  collections: Record<string, PathCollectionOptions>
}

export const PATH_FIELD_RUNTIME_CONFIG_KEY = '@sittari/payload-path-field/config'
export const PATH_ALLOW_UNRESOLVED_CONTEXT_KEY = 'sittariPathFieldAllowUnresolved'
export const PATH_REBUILD_CONTEXT_KEY = 'sittariPathFieldRebuild'

export type PathLookupQueryOptions = {
  context?: Record<string, unknown>
  currentDepth?: number
  depth?: number
  disableErrors?: boolean
  draft?: boolean
  fallbackLocale?: false | null | string | string[]
  includeLockStatus?: boolean
  joins?: Record<string, unknown> | false
  overrideAccess?: boolean
  populate?: Record<string, unknown>
  req?: Partial<PayloadRequest>
  select?: SelectType
  showHiddenFields?: boolean
  trash?: boolean
  user?: Record<string, unknown>
}

export type FindDocumentByPathArgs = PathLookupQueryOptions & {
  collection?: string
  locale?: string
  pagination?: boolean
  path: string
}

export type PathRoute = {
  canonicalPath: string
  isCanonical: boolean
  page: number
}

export type FoundDocumentByPath = {
  collection: string
  document: Record<string, unknown>
  route?: PathRoute
}

export type RebuildDocumentPathsArgs = {
  batchSize?: number
  collection?: string
}

export type RebuildDocumentPathsResult = {
  updated: number
}

export type PathHelpers = {
  buildPaginatedPath: typeof import('./pagination.js').buildPaginatedPath
  cleanPathSegment: typeof import('./path.js').cleanPathSegment
  findDocumentByPath: (
    args: FindDocumentByPathArgs,
  ) => Promise<FoundDocumentByPath | null>
  isValidDocumentPath: typeof import('./path.js').isValidDocumentPath
  joinPathSegments: typeof import('./path.js').joinPathSegments
  parsePaginatedPath: typeof import('./pagination.js').parsePaginatedPath
  rebuildDocumentPaths: (
    args?: RebuildDocumentPathsArgs,
  ) => Promise<RebuildDocumentPathsResult>
  validateDocumentPath: typeof import('./path.js').validateDocumentPath
}

export type PathBeforeChangeHook = CollectionBeforeChangeHook

export type PathConfig = Config & {
  custom?: Record<string, unknown>
}

export type PathWhere = Where
