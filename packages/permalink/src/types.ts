import type { CollectionBeforeChangeHook, Config } from 'payload';

export type LocalePrefixMode = 'always' | 'as-needed';

export type PathCollectionOptions = {
  /** URL prefix for this collection. Use an empty string for root-level documents. */
  prefix: string;
  /** Optional self-referencing parent field for hierarchical permalinks. */
  parentField?: string;
};

export type PermalinkPluginConfig = {
  collections: Record<string, false | PathCollectionOptions>;
  enabled?: boolean;
  /** Prefix localized paths with every locale or only non-default locales. */
  localePrefix?: LocalePrefixMode;
  /** Public site URL used by the permalink editor. */
  siteUrl: string;
};

export type PathFieldRuntimeConfig = {
  collections: Record<string, PathCollectionOptions>;
  localePrefix: LocalePrefixMode;
};

export const PATH_FIELD_RUNTIME_CONFIG_KEY =
  '@sittari/payload-permalink/config';
export const PATH_ALLOW_UNRESOLVED_CONTEXT_KEY =
  'sittariPathFieldAllowUnresolved';
export const PATH_AUTOSAVE_CONTEXT_KEY = 'sittariPathFieldAutosave';
export const PATH_REMOVE_ALL_ROUTES_CONTEXT_KEY =
  'sittariPathFieldRemoveAllRoutes';
export const PATH_REBUILD_CONTEXT_KEY = 'sittariPathFieldRebuild';

export type FindDocumentByPathArgs = {
  path: string;
  overrideAccess?: boolean;
};

export type PathRoute = {
  canonicalPath: string;
  isCanonical: boolean;
  page: number;
};

export type FoundDocumentByPath = {
  collection: string;
  document: Record<string, unknown>;
  route?: PathRoute;
};

export type RebuildDocumentPathsArgs = {
  batchSize?: number;
  collection?: string;
};

export type RebuildDocumentPathsResult = {
  updated: number;
};

export type PathHelpers = {
  buildPaginatedPath: typeof import('./pagination.js').buildPaginatedPath;
  cleanPathSegment: typeof import('./path.js').cleanPathSegment;
  findDocumentByPath: (
    args: FindDocumentByPathArgs,
  ) => Promise<FoundDocumentByPath | null>;
  isValidDocumentPath: typeof import('./path.js').isValidDocumentPath;
  joinPathSegments: typeof import('./path.js').joinPathSegments;
  parsePaginatedPath: typeof import('./pagination.js').parsePaginatedPath;
  rebuildDocumentPaths: (
    args?: RebuildDocumentPathsArgs,
  ) => Promise<RebuildDocumentPathsResult>;
  validateDocumentPath: typeof import('./path.js').validateDocumentPath;
};

export type PathBeforeChangeHook = CollectionBeforeChangeHook;

export type PathConfig = Config & {
  custom?: Record<string, unknown>;
};
