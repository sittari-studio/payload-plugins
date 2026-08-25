import {
  ValidationError,
  type CollectionAfterChangeHook,
  type CollectionAfterDeleteHook,
  type CollectionBeforeChangeHook,
  type CollectionBeforeOperationHook,
  type PayloadRequest,
} from 'payload';

import { HOME_SLUG } from './permalink.js';
import { joinPathSegments, validateDocumentPath } from './path.js';
import {
  deletePathRoutes,
  findPathRouteByPath,
  upsertPathRoute,
} from './routes.js';
import { formatPermalinkSlug } from './slug.js';
import { translatePathValidationMessage } from './translations.js';
import type { LocalePrefixMode, PathCollectionOptions } from './types.js';
import {
  PATH_ALLOW_UNRESOLVED_CONTEXT_KEY,
  PATH_REBUILD_CONTEXT_KEY,
  PATH_REMOVE_ALL_ROUTES_CONTEXT_KEY,
} from './types.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isTrue = (value: unknown): boolean => value === true || value === 'true';

const valueForLocale = (
  value: unknown,
  locale: string,
  locales: Set<string>,
): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => valueForLocale(entry, locale, locales));
  }
  if (!isRecord(value)) return value;

  const keys = Object.keys(value);
  if (keys.length > 0 && keys.every((key) => locales.has(key))) {
    return valueForLocale(value[locale], locale, locales);
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      valueForLocale(entry, locale, locales),
    ]),
  );
};

const getRelationshipID = (value: unknown): number | string | undefined => {
  if (typeof value === 'number' || typeof value === 'string') return value;
  if (
    isRecord(value) &&
    (typeof value.id === 'number' || typeof value.id === 'string')
  ) {
    return value.id;
  }
  return undefined;
};

const permalinkValidationError = ({
  collection,
  message,
  req,
}: {
  collection: string;
  message: string;
  req: PayloadRequest;
}) =>
  new ValidationError(
    {
      collection,
      errors: [
        {
          message: translatePathValidationMessage(message, req.i18n?.language),
          path: 'slug',
        },
      ],
      req,
    },
    req.t,
  );

const unresolvedPath = ({
  allowUnresolved,
  collection,
  message,
  req,
}: {
  allowUnresolved: boolean;
  collection: string;
  message: string;
  req: PayloadRequest;
}): null => {
  if (allowUnresolved) return null;
  throw permalinkValidationError({ collection, message, req });
};

const assertGeneratedPath = ({
  collection,
  path,
  req,
}: {
  collection: string;
  path: string;
  req: PayloadRequest;
}): string => {
  const validationResult = validateDocumentPath(path);
  if (validationResult === true) return path;

  throw permalinkValidationError({
    collection,
    message: validationResult,
    req,
  });
};

export const markPathUnresolvedOperation: CollectionBeforeOperationHook = ({
  args,
  operation,
}) => {
  const data =
    'data' in args && isRecord(args.data)
      ? (args.data as Record<string, unknown>)
      : undefined;

  const restoringFromTrash =
    operation === 'update' &&
    'trash' in args &&
    args.trash === true &&
    data?.deletedAt === null;

  if (restoringFromTrash && data) {
    data._status = 'draft';
    (args as typeof args & { draft?: boolean }).draft = true;
  }

  const isPublishing =
    data?._status === 'published' ||
    ('publishAllLocales' in args && isTrue(args.publishAllLocales)) ||
    ('publishSpecificLocale' in args && Boolean(args.publishSpecificLocale));
  const isReleasingRoute =
    ('unpublishAllLocales' in args && isTrue(args.unpublishAllLocales)) ||
    data?.deletedAt != null;
  const allowsUnresolved =
    (operation === 'create' || operation === 'update') &&
    !isPublishing &&
    !isReleasingRoute &&
    (('autosave' in args && args.autosave === true) ||
      ('draft' in args && args.draft === true));
  const context = args.req?.context;

  if (context && allowsUnresolved) {
    context[PATH_ALLOW_UNRESOLVED_CONTEXT_KEY] = true;
  }
  if (
    context &&
    (('unpublishAllLocales' in args && isTrue(args.unpublishAllLocales)) ||
      data?.deletedAt != null)
  ) {
    context[PATH_REMOVE_ALL_ROUTES_CONTEXT_KEY] = true;
  }
  return args;
};

const shouldPrefixLocale = ({
  defaultLocale,
  locale,
  localePrefix,
}: {
  defaultLocale?: string;
  locale?: string;
  localePrefix: LocalePrefixMode;
}): boolean =>
  Boolean(
    locale &&
    (localePrefix === 'always' ||
      (defaultLocale !== undefined && locale !== defaultLocale)),
  );

type ResolvedPermalink = {
  path: null | string;
  slug: null | string;
};

const resolveForLocale = async ({
  allowUnresolved,
  collection,
  data,
  defaultLocale,
  locale,
  localePrefix,
  locales,
  options,
  originalDoc,
  req,
  useAsSlug,
}: {
  allowUnresolved: boolean;
  collection: string;
  data: Record<string, unknown>;
  defaultLocale?: string;
  locale?: string;
  localePrefix: LocalePrefixMode;
  locales: Set<string>;
  options: PathCollectionOptions;
  originalDoc?: Record<string, unknown>;
  req: PayloadRequest;
  useAsSlug: string;
}): Promise<ResolvedPermalink> => {
  const localizedOriginal = locale
    ? (valueForLocale(originalDoc ?? {}, locale, locales) as Record<
        string,
        unknown
      >)
    : (originalDoc ?? {});
  const localizedData = locale
    ? (valueForLocale(data, locale, locales) as Record<string, unknown>)
    : data;
  const effective = { ...localizedOriginal, ...localizedData };

  const explicitSlug = effective.slug;
  const source = effective[useAsSlug];
  const slug =
    typeof explicitSlug === 'string' && explicitSlug.length > 0
      ? formatPermalinkSlug(explicitSlug, locale)
      : typeof source === 'string' && source.length > 0
        ? formatPermalinkSlug(source, locale)
        : null;

  if (!slug) {
    return {
      path: unresolvedPath({
        allowUnresolved,
        collection,
        message: 'A slug is required to build the permalink.',
        req,
      }),
      slug: null,
    };
  }

  const slugSegment = slug === HOME_SLUG ? undefined : slug;

  if (options.parentField) {
    const parentID = getRelationshipID(effective[options.parentField]);
    if (parentID !== undefined) {
      const parentArgs = {
        collection: collection as never,
        depth: 0,
        draft: false,
        fallbackLocale: false,
        id: parentID,
        ...(locale ? { locale: locale as never } : {}),
        overrideAccess: true,
        req,
        select: { path: true },
      };
      const parent = await req.payload.findByID(parentArgs as never);
      const parentPath = (parent as unknown as Record<string, unknown>).path;
      if (typeof parentPath !== 'string' || parentPath.length === 0) {
        return {
          path: unresolvedPath({
            allowUnresolved,
            collection,
            message:
              'The parent document must have a permalink before this document can be routed.',
            req,
          }),
          slug,
        };
      }
      return {
        path: assertGeneratedPath({
          collection,
          path: joinPathSegments(parentPath, slugSegment),
          req,
        }),
        slug,
      };
    }
  }

  return {
    path: assertGeneratedPath({
      collection,
      path: joinPathSegments(
        shouldPrefixLocale({ defaultLocale, locale, localePrefix })
          ? locale
          : undefined,
        options.prefix,
        slugSegment,
      ),
      req,
    }),
    slug,
  };
};

export const createPathBeforeChangeHook = ({
  collection,
  collectionHasDrafts,
  defaultLocale,
  localeCodes,
  localePrefix,
  options,
  useAsSlug,
}: {
  collection: string;
  collectionHasDrafts: boolean;
  defaultLocale?: string;
  localeCodes: string[];
  localePrefix: LocalePrefixMode;
  options: PathCollectionOptions;
  useAsSlug: string;
}): CollectionBeforeChangeHook => {
  const locales = new Set(localeCodes);

  return async ({ context, data, originalDoc, req }) => {
    const restoringFromTrash =
      collectionHasDrafts &&
      originalDoc?.deletedAt != null &&
      data.deletedAt === null;
    const effectiveData = restoringFromTrash
      ? { ...data, _status: 'draft' }
      : data;
    const requestLocale = (req as PayloadRequest & { locale?: string }).locale;
    const allowUnresolved =
      context[PATH_ALLOW_UNRESOLVED_CONTEXT_KEY] === true ||
      context[PATH_REBUILD_CONTEXT_KEY] === true;

    if (requestLocale === 'all') {
      const paths: Record<string, null | string> = {};
      const slugs: Record<string, null | string> = {};
      for (const locale of localeCodes) {
        const resolved = await resolveForLocale({
          allowUnresolved,
          collection,
          data: effectiveData,
          defaultLocale,
          locale,
          localePrefix,
          locales,
          options,
          originalDoc,
          req,
          useAsSlug,
        });
        paths[locale] = resolved.path;
        slugs[locale] = resolved.slug;
      }
      return { ...effectiveData, path: paths, slug: slugs };
    }

    const locale =
      localeCodes.length > 0 ? (requestLocale ?? defaultLocale) : undefined;
    const resolved = await resolveForLocale({
      allowUnresolved,
      collection,
      data: effectiveData,
      defaultLocale,
      locale,
      localePrefix,
      locales,
      options,
      originalDoc,
      req,
      useAsSlug,
    });
    return { ...effectiveData, path: resolved.path, slug: resolved.slug };
  };
};

const getLocalizedValue = (value: unknown, locale?: string): unknown => {
  if (!locale || !isRecord(value)) return value;
  return locale in value ? value[locale] : value;
};

const getChangeLocales = ({
  defaultLocale,
  doc,
  localeCodes,
  req,
}: {
  defaultLocale?: string;
  doc: Record<string, unknown>;
  localeCodes: string[];
  req: PayloadRequest;
}): Array<string | undefined> => {
  if (localeCodes.length === 0) return [undefined];

  const requestLocale = (req as PayloadRequest & { locale?: string }).locale;
  if (requestLocale === 'all' || (!requestLocale && isRecord(doc.path))) {
    return localeCodes;
  }
  return [requestLocale ?? defaultLocale ?? localeCodes[0]];
};

const isPublishedDocument = ({
  collectionHasDrafts,
  document,
  locale,
}: {
  collectionHasDrafts: boolean;
  document: Record<string, unknown>;
  locale?: string;
}): boolean => {
  if (document.deletedAt != null) return false;
  if (!collectionHasDrafts) return true;
  return getLocalizedValue(document._status, locale) === 'published';
};

const routeBelongsToAnotherDocument = ({
  collection,
  documentID,
  locale,
  route,
}: {
  collection: string;
  documentID: string;
  locale?: string;
  route: Awaited<ReturnType<typeof findPathRouteByPath>>;
}): boolean =>
  Boolean(
    route &&
    (route.collection !== collection ||
      route.documentID !== documentID ||
      route.locale !== locale),
  );

const updateLocalizedResult = ({
  document,
  locale,
  path,
  slug,
}: {
  document: Record<string, unknown>;
  locale?: string;
  path: unknown;
  slug: unknown;
}): Record<string, unknown> => {
  if (!locale || !isRecord(document.path) || !isRecord(document.slug)) {
    return { ...document, path, slug };
  }

  return {
    ...document,
    path: { ...document.path, [locale]: path },
    slug: { ...document.slug, [locale]: slug },
  };
};

export const createPathAfterChangeHook =
  ({
    collection,
    collectionHasDrafts,
    defaultLocale,
    localeCodes,
  }: {
    collection: string;
    collectionHasDrafts: boolean;
    defaultLocale?: string;
    localeCodes: string[];
  }): CollectionAfterChangeHook =>
  async ({ context, doc, previousDoc, req }) => {
    const clearContext = () => {
      delete context[PATH_ALLOW_UNRESOLVED_CONTEXT_KEY];
      delete context[PATH_REMOVE_ALL_ROUTES_CONTEXT_KEY];
    };

    if (
      collectionHasDrafts &&
      context[PATH_ALLOW_UNRESOLVED_CONTEXT_KEY] === true
    ) {
      clearContext();
      return doc;
    }

    let document = doc as unknown as Record<string, unknown>;
    const id = document.id ?? previousDoc.id;
    const documentID = String(id);

    try {
      if (context[PATH_REMOVE_ALL_ROUTES_CONTEXT_KEY] === true) {
        await deletePathRoutes({
          collection,
          documentID,
          payload: req.payload,
          req,
        });
        return doc;
      }

      if (
        !('path' in document) ||
        !('slug' in document) ||
        (collectionHasDrafts && !('_status' in document))
      ) {
        const hydrateArgs = {
          collection: collection as never,
          depth: 0,
          draft: false,
          fallbackLocale: false,
          id: id as never,
          locale: (req as PayloadRequest & { locale?: string }).locale as never,
          overrideAccess: true,
          req,
          select: {
            id: true,
            path: true,
            slug: true,
            ...(collectionHasDrafts ? { _status: true } : {}),
          },
        };
        const hydrated = await req.payload.findByID(hydrateArgs as never);
        document = {
          ...document,
          ...(hydrated as unknown as Record<string, unknown>),
        };
      }

      for (const locale of getChangeLocales({
        defaultLocale,
        doc: document,
        localeCodes,
        req,
      })) {
        const path = getLocalizedValue(document.path, locale);
        const published = isPublishedDocument({
          collectionHasDrafts,
          document,
          locale,
        });

        if (published && typeof path === 'string') {
          const conflictingRoute = await findPathRouteByPath({
            path,
            payload: req.payload,
            req,
          });

          if (
            routeBelongsToAnotherDocument({
              collection,
              documentID,
              locale,
              route: conflictingRoute,
            })
          ) {
            const currentSlug = getLocalizedValue(document.slug, locale);
            const suffix = `-${documentID}`;

            if (
              typeof currentSlug !== 'string' ||
              currentSlug.length === 0 ||
              currentSlug.endsWith(suffix)
            ) {
              throw permalinkValidationError({
                collection,
                message: 'This permalink is already in use.',
                req,
              });
            }

            const suffixedSlug = formatPermalinkSlug(
              `${currentSlug}${suffix}`,
              locale,
            );
            const status = getLocalizedValue(document._status, locale);
            const updateArgs = {
              collection: collection as never,
              data: {
                slug: suffixedSlug,
                ...(collectionHasDrafts &&
                (status === 'draft' || status === 'published')
                  ? { _status: status }
                  : {}),
              },
              id: id as never,
              ...(locale ? { locale: locale as never } : {}),
              overrideAccess: true,
              req,
            };
            const updated = (await req.payload.update(
              updateArgs as never,
            )) as unknown as Record<string, unknown>;

            document = updateLocalizedResult({
              document,
              locale,
              path: updated.path,
              slug: updated.slug,
            });
            continue;
          }
        }

        if (!published || typeof path !== 'string') {
          await deletePathRoutes({
            collection,
            documentID,
            locale,
            payload: req.payload,
            req,
          });
          continue;
        }

        await upsertPathRoute({
          collection,
          documentID,
          locale,
          path,
          payload: req.payload,
          req,
        });
      }
    } finally {
      clearContext();
    }

    return document as never;
  };

export const createPathAfterDeleteHook =
  ({ collection }: { collection: string }): CollectionAfterDeleteHook =>
  async ({ id, req }) => {
    await deletePathRoutes({
      collection,
      documentID: String(id),
      payload: req.payload,
      req,
    });
  };
