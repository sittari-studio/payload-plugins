import type { Payload } from 'payload';

import { findPathRouteByPath } from './routes.js';
import { buildPaginatedPath, parsePaginatedPath } from './pagination.js';
import {
  cleanPathSegment,
  isValidDocumentPath,
  joinPathSegments,
  validateDocumentPath,
} from './path.js';
import { rebuildDocumentPathsWithPayload } from './rebuild.js';
import type {
  FindDocumentByPathArgs,
  FoundDocumentByPath,
  PathHelpers,
} from './types.js';

export type CreatePathHelpersArgs = {
  getPayload: () => Payload | Promise<Payload>;
};

const getRouteDocumentID = ({
  payload,
  route,
}: {
  payload: Payload;
  route: { collection: string; documentID: string };
}): number | string => {
  const collection = payload.collections[route.collection] as
    | { customIDType?: 'number' | 'text' }
    | undefined;
  const idType = collection?.customIDType ?? payload.db.defaultIDType;
  return idType === 'number' ? Number(route.documentID) : route.documentID;
};

const findRouteDocument = async ({
  args,
  payload,
  path,
}: {
  args: FindDocumentByPathArgs;
  path: string;
  payload: Payload;
}): Promise<FoundDocumentByPath | null> => {
  const route = await findPathRouteByPath({ path, payload });
  if (!route) return null;

  const document = await payload.findByID({
    collection: route.collection as never,
    draft: false,
    fallbackLocale: false,
    id: getRouteDocumentID({ payload, route }),
    ...(route.locale ? { locale: route.locale } : {}),
    overrideAccess: args.overrideAccess ?? false,
  } as never);

  return {
    collection: route.collection,
    document: document as unknown as Record<string, unknown>,
    route: {
      canonicalPath: path,
      isCanonical: true,
      page: 1,
    },
  };
};

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
    if (!isValidDocumentPath(args.path)) return null;
    const payload = await getPayload();
    const exact = await findRouteDocument({
      args,
      path: args.path,
      payload,
    });
    if (exact) return exact;

    const parsed = parsePaginatedPath(args.path);
    if (!parsed) return null;

    const base = await findRouteDocument({
      args,
      path: parsed.basePath,
      payload,
    });
    if (!base) return null;
    return {
      ...base,
      route: {
        canonicalPath: parsed.canonicalPath,
        isCanonical: parsed.isCanonical,
        page: parsed.page,
      },
    };
  },

  rebuildDocumentPaths: async (args) =>
    rebuildDocumentPathsWithPayload(await getPayload(), args),
});
