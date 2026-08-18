import {
  ValidationError,
  type CollectionAfterChangeHook,
  type CollectionAfterDeleteHook,
  type CollectionBeforeChangeHook,
  type CollectionBeforeOperationHook,
  type PayloadRequest,
} from "payload";

import { deletePathRoutes, upsertPathRoute } from "./routes.js";
import { validateDocumentPath } from "./path.js";
import type { PathCollectionOptions, ResolveDocumentUrl } from "./types.js";
import {
  PATH_ALLOW_UNRESOLVED_CONTEXT_KEY,
  PATH_REMOVE_ALL_ROUTES_CONTEXT_KEY,
  PATH_REBUILD_CONTEXT_KEY,
} from "./types.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

// Payload flags may arrive as booleans or string query parameters.
const isTrue = (value: unknown): boolean => value === true || value === "true";

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
  if (typeof value === "number" || typeof value === "string") return value;
  if (
    isRecord(value) &&
    (typeof value.id === "number" || typeof value.id === "string")
  ) {
    return value.id;
  }
  return undefined;
};

const assertResolvedDocumentPath: (
  path: unknown,
  collection: string,
  req: PayloadRequest,
) => asserts path is string = (path, collection, req) => {
  const validationResult = validateDocumentPath(path);
  if (validationResult !== true) {
    throw new ValidationError({
      collection,
      errors: [
        {
          message: validationResult,
          path: "path",
        },
      ],
      req,
    });
  }
};

const populateParent = async ({
  collection,
  doc,
  locale,
  options,
  req,
}: {
  collection: string;
  doc: Record<string, unknown>;
  locale?: string;
  options: PathCollectionOptions;
  req: PayloadRequest;
}): Promise<Record<string, unknown>> => {
  if (!options.parentField) return doc;
  const parentID = getRelationshipID(doc[options.parentField]);
  if (parentID === undefined) return doc;

  const parent = await req.payload.findByID({
    collection: collection as never,
    depth: 1,
    fallbackLocale: false,
    id: parentID,
    locale: locale as never,
    overrideAccess: true,
    req,
  });
  return { ...doc, [options.parentField]: parent };
};

export const markPathUnresolvedOperation: CollectionBeforeOperationHook = ({
  args,
  operation,
}) => {
  const data = "data" in args && isRecord(args.data) ? args.data : undefined;
  const dataRecord = data as Record<string, unknown> | undefined;
  const isPublishing =
    dataRecord?._status === "published" ||
    ("publishAllLocales" in args && isTrue(args.publishAllLocales)) ||
    ("publishSpecificLocale" in args && Boolean(args.publishSpecificLocale));
  const isReleasingRoute =
    ("unpublishAllLocales" in args && isTrue(args.unpublishAllLocales)) ||
    ("trash" in args && isTrue(args.trash)) ||
    dataRecord?.deletedAt != null;
  const allowsUnresolved =
    (operation === "create" || operation === "update") &&
    !isPublishing &&
    !isReleasingRoute &&
    (("autosave" in args && args.autosave === true) ||
      ("draft" in args && args.draft === true));
  const context = args.req?.context;

  if (context && allowsUnresolved) {
    context[PATH_ALLOW_UNRESOLVED_CONTEXT_KEY] = true;
  }
  if (
    context &&
    (("unpublishAllLocales" in args && isTrue(args.unpublishAllLocales)) ||
      dataRecord?.deletedAt != null)
  ) {
    context[PATH_REMOVE_ALL_ROUTES_CONTEXT_KEY] = true;
  }
  return args;
};

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
  collection: string;
  data: Record<string, unknown>;
  allowUnresolved: boolean;
  locale?: string;
  locales: Set<string>;
  options: PathCollectionOptions;
  originalDoc?: Record<string, unknown>;
  req: PayloadRequest;
  resolver: ResolveDocumentUrl;
}): Promise<null | string> => {
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
  delete effective.path;

  const doc = await populateParent({
    collection,
    doc: effective,
    locale,
    options,
    req,
  });
  const path = await resolver({
    collection,
    doc,
    locale,
    payload: req.payload,
    req,
  });
  if (path === null && allowUnresolved) return null;
  assertResolvedDocumentPath(path, collection, req);
  return path;
};

export const createPathBeforeChangeHook = ({
  collection,
  defaultLocale,
  localeCodes,
  options,
  resolver,
}: {
  collection: string;
  defaultLocale?: string;
  localeCodes: string[];
  options: PathCollectionOptions;
  resolver: ResolveDocumentUrl;
}): CollectionBeforeChangeHook => {
  const locales = new Set(localeCodes);

  return async ({ context, data, operation, originalDoc, req }) => {
    const requestLocale = (req as PayloadRequest & { locale?: string }).locale;
    const allowUnresolved =
      context[PATH_ALLOW_UNRESOLVED_CONTEXT_KEY] === true ||
      context[PATH_REBUILD_CONTEXT_KEY] === true;
    if (requestLocale === "all") {
      const paths: Record<string, null | string> = {};
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
        });
      }
      return { ...data, path: paths };
    }

    const locale =
      localeCodes.length > 0 ? (requestLocale ?? defaultLocale) : undefined;
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
    });
    return { ...data, path };
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
  if (requestLocale === "all" || (!requestLocale && isRecord(doc.path))) {
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
  return getLocalizedValue(document._status, locale) === "published";
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
    const documentID = String(document.id ?? previousDoc.id);
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
        !("path" in document) ||
        (collectionHasDrafts && !("_status" in document))
      ) {
        const hydrated = await req.payload.findByID({
          collection: collection as never,
          depth: 0,
          draft: false,
          fallbackLocale: false,
          id: documentID,
          locale: (req as PayloadRequest & { locale?: string }).locale as never,
          overrideAccess: true,
          req,
          select: {
            id: true,
            path: true,
            ...(collectionHasDrafts ? { _status: true } : {}),
          },
        } as never);
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

        if (!published || typeof path !== "string") {
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

    return doc;
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
