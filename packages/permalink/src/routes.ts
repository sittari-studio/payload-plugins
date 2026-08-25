import type { CollectionConfig, Payload, PayloadRequest, Where } from 'payload';

import { isValidDocumentPath } from './path.js';
import { PATH_FIELD_RUNTIME_CONFIG_KEY } from './types.js';

export const PATH_ROUTES_COLLECTION = 'path-routes';

export type PathRouteDocument = {
  collection: string;
  documentID: string;
  id: number | string;
  locale?: string;
  path: string;
};

export const createPathRoutesCollection = (
  localized: boolean,
): CollectionConfig => ({
  access: {
    create: () => false,
    delete: () => false,
    read: () => false,
    update: () => false,
  },
  admin: {
    hidden: true,
  },
  endpoints: false,
  fields: [
    {
      name: 'path',
      required: true,
      type: 'text',
      unique: true,
    },
    {
      name: 'collection',
      required: true,
      type: 'text',
    },
    {
      name: 'documentID',
      required: true,
      type: 'text',
    },
    ...(localized
      ? [
          {
            name: 'locale',
            required: true,
            type: 'text' as const,
          },
        ]
      : []),
  ],
  graphQL: false,
  indexes: [
    {
      fields: localized
        ? ['collection', 'documentID', 'locale']
        : ['collection', 'documentID'],
      unique: true,
    },
  ],
  slug: PATH_ROUTES_COLLECTION,
  timestamps: false,
});

const routeCollection = PATH_ROUTES_COLLECTION as never;

const routeWhere = ({
  collection,
  documentID,
  locale,
}: {
  collection: string;
  documentID: string;
  locale?: string;
}): Where => ({
  and: [
    { collection: { equals: collection } },
    { documentID: { equals: documentID } },
    ...(locale === undefined ? [] : [{ locale: { equals: locale } }]),
  ],
});

const routeFind = async ({
  collection,
  documentID,
  locale,
  payload,
  req,
}: {
  collection: string;
  documentID: string;
  locale?: string;
  payload: Payload;
  req?: PayloadRequest;
}): Promise<PathRouteDocument | null> => {
  const findArgs = {
    collection: routeCollection,
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    ...(req ? { req } : {}),
    where: routeWhere({ collection, documentID, locale }),
  };
  const result = await payload.find(findArgs as never);

  return (result.docs[0] as PathRouteDocument | undefined) ?? null;
};

export const findPathRouteByPath = async ({
  path,
  payload,
  req,
}: {
  path: string;
  payload: Payload;
  req?: PayloadRequest;
}): Promise<PathRouteDocument | null> => {
  const findArgs = {
    collection: routeCollection,
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    ...(req ? { req } : {}),
    where: { path: { equals: path } },
  };
  const result = await payload.find(findArgs as never);

  return (result.docs[0] as PathRouteDocument | undefined) ?? null;
};

export const deletePathRoutes = async ({
  collection,
  documentID,
  locale,
  payload,
  req,
}: {
  collection: string;
  documentID: string;
  locale?: string;
  payload: Payload;
  req?: PayloadRequest;
}): Promise<void> => {
  const deleteArgs = {
    collection: routeCollection,
    overrideAccess: true,
    ...(req ? { req } : {}),
    where: routeWhere({ collection, documentID, locale }),
  };
  await payload.delete(deleteArgs as never);
};

export const upsertPathRoute = async ({
  collection,
  documentID,
  locale,
  path,
  payload,
  req,
}: {
  collection: string;
  documentID: string;
  locale?: string;
  path: string;
  payload: Payload;
  req?: PayloadRequest;
}): Promise<void> => {
  const existing = await routeFind({
    collection,
    documentID,
    locale,
    payload,
    req,
  });
  const data = {
    collection,
    documentID,
    ...(locale === undefined ? {} : { locale }),
    path,
  };

  if (existing) {
    const updateArgs = {
      collection: routeCollection,
      data,
      id: existing.id,
      overrideAccess: true,
      ...(req ? { req } : {}),
    };
    await payload.update(updateArgs as never);
    return;
  }

  const createArgs = {
    collection: routeCollection,
    data,
    overrideAccess: true,
    ...(req ? { req } : {}),
  };
  await payload.create(createArgs as never);
};

export const backfillPublishedPathRoutes = async (
  payload: Payload,
  { force = false }: { force?: boolean } = {},
): Promise<void> => {
  if (!force) {
    const existingArgs = {
      collection: routeCollection,
      depth: 0,
      limit: 1,
      overrideAccess: true,
      pagination: false,
    };
    const existing = await payload.find(existingArgs as never);
    if (existing.docs.length > 0) return;
  }

  const runtime = payload.config.custom?.[PATH_FIELD_RUNTIME_CONFIG_KEY] as
    | { collections?: Record<string, unknown> }
    | undefined;
  if (!runtime?.collections) return;

  const localization = payload.config.localization;
  const locales = localization
    ? localization.locales.map((locale) =>
        typeof locale === 'string' ? locale : locale.code,
      )
    : [undefined];

  for (const collection of Object.keys(runtime.collections)) {
    const collectionConfig = payload.config.collections.find(
      (candidate) => candidate.slug === collection,
    );
    const collectionHasDrafts =
      typeof collectionConfig?.versions === 'object' &&
      Boolean(collectionConfig.versions.drafts);
    for (const locale of locales) {
      let page = 1;
      while (true) {
        const findArgs = {
          collection: collection as never,
          depth: 0,
          draft: false,
          fallbackLocale: false,
          limit: 100,
          ...(locale === undefined ? {} : { locale }),
          overrideAccess: true,
          page,
          select: { id: true, path: true },
          ...(collectionHasDrafts
            ? { where: { _status: { equals: 'published' } } }
            : {}),
        };
        const result = await payload.find(findArgs as never);

        for (const document of result.docs as Array<{
          id: number | string;
          path?: null | string;
        }>) {
          if (
            typeof document.path !== 'string' ||
            !isValidDocumentPath(document.path)
          ) {
            continue;
          }
          await upsertPathRoute({
            collection,
            documentID: String(document.id),
            locale,
            path: document.path,
            payload,
          });
        }

        if (!result.hasNextPage) break;
        page += 1;
      }
    }
  }
};
