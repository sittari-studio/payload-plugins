import type { Field, FieldHook, PayloadRequest } from 'payload';

import { mergeTemplateValues } from './templateFieldFields.js';

const CACHE_KEY = '@sittari/payload-templates/template-field-cache';

type TemplateFieldsMode = 'raw' | 'resolved';

type TemplateFieldCache = {
  lookups: Map<string, Promise<undefined | Record<string, unknown>>>;
  warned: Set<string>;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const isPathWithinRoute = (pathname: string, route: string): boolean => {
  const normalizedRoute = route === '/' ? route : route.replace(/\/+$/, '');

  return (
    pathname === normalizedRoute ||
    (normalizedRoute !== '/' && pathname.startsWith(`${normalizedRoute}/`))
  );
};

const isAdminAPIInspector = (pathname: string, adminRoute: string): boolean => {
  if (!isPathWithinRoute(pathname, adminRoute)) {
    return false;
  }

  const normalizedRoute =
    adminRoute === '/' ? '' : adminRoute.replace(/\/+$/, '');
  const segments = pathname
    .slice(normalizedRoute.length)
    .split('/')
    .filter(Boolean);

  return (
    ((segments[0] === 'collections' && segments.length >= 4) ||
      (segments[0] === 'globals' && segments.length >= 3)) &&
    segments.at(-1) === 'api'
  );
};

const getReferrerPathname = (req: PayloadRequest): string | undefined => {
  const referrer = req.headers?.get('referer');
  if (!referrer) {
    return undefined;
  }

  try {
    return new URL(referrer).pathname;
  } catch {
    return undefined;
  }
};

const shouldResolveTemplateFields = ({
  context,
  req,
}: {
  context: Record<string, unknown>;
  req: PayloadRequest;
}): boolean => {
  const mode = context.templateFields as TemplateFieldsMode | undefined;
  if (mode === 'raw') {
    return false;
  }
  if (mode === 'resolved') {
    return true;
  }

  const adminRoute = req.payload.config?.routes?.admin;
  if (!adminRoute) {
    return true;
  }

  const requestPathname = req.pathname;
  if (
    requestPathname &&
    isPathWithinRoute(requestPathname, adminRoute) &&
    !isAdminAPIInspector(requestPathname, adminRoute)
  ) {
    return false;
  }

  const referrerPathname = getReferrerPathname(req);
  return !(
    referrerPathname &&
    isPathWithinRoute(referrerPathname, adminRoute) &&
    !isAdminAPIInspector(referrerPathname, adminRoute)
  );
};

const getCache = (context: Record<string, unknown>): TemplateFieldCache => {
  const existing = context[CACHE_KEY];

  if (
    existing &&
    typeof existing === 'object' &&
    'lookups' in existing &&
    existing.lookups instanceof Map &&
    'warned' in existing &&
    existing.warned instanceof Set
  ) {
    return existing as TemplateFieldCache;
  }

  const cache: TemplateFieldCache = {
    lookups: new Map(),
    warned: new Set(),
  };
  context[CACHE_KEY] = cache;
  return cache;
};

const localeCacheKey = (locale: unknown): string =>
  Array.isArray(locale) ? locale.join(',') : String(locale ?? '');

const containsReference = (
  value: unknown,
  target: unknown,
  seen: Set<object> = new Set(),
): boolean => {
  if (value === target) {
    return true;
  }

  if (!value || typeof value !== 'object' || seen.has(value)) {
    return false;
  }

  seen.add(value);

  return Array.isArray(value)
    ? value.some((childValue) => containsReference(childValue, target, seen))
    : Object.values(value).some((childValue) =>
        containsReference(childValue, target, seen),
      );
};

const isLexicalDocument = (value: unknown): boolean =>
  isPlainObject(value) &&
  isPlainObject(value.root) &&
  Array.isArray(value.root.children);

const isLocalizedRichTextValue = ({
  data,
  path,
  value,
}: {
  data?: unknown;
  path?: (number | string)[];
  value: unknown;
}): boolean => {
  if (!data || !path?.length || !isPlainObject(data)) {
    return false;
  }

  const firstPathSegment = path[0];
  if (typeof firstPathSegment !== 'string') {
    return false;
  }

  const richTextValue = data[firstPathSegment];
  if (isLexicalDocument(richTextValue)) {
    return true;
  }

  return (
    isPlainObject(richTextValue) &&
    Object.values(richTextValue).some(
      (localizedValue) =>
        isLexicalDocument(localizedValue) &&
        containsReference(localizedValue, value),
    )
  );
};

const getEffectiveLocale = ({
  fieldName,
  req,
  siblingData,
  data,
  path,
  value,
}: {
  fieldName: string;
  req: PayloadRequest;
  siblingData: Record<string, unknown>;
  data?: unknown;
  path?: (number | string)[];
  value: unknown;
}): string | undefined => {
  if (req.locale !== 'all') {
    return req.locale ?? undefined;
  }

  const localizedValues = siblingData[fieldName];
  if (isPlainObject(localizedValues)) {
    const siblingLocale = Object.entries(localizedValues).find(
      ([, localizedValue]) => localizedValue === value,
    )?.[0];

    if (siblingLocale) {
      return siblingLocale;
    }
  }

  // Lexical runs localized node hooks with req.locale set to `all`. Locate the
  // current node in the corresponding localized document to recover its locale.
  if (!data || !path?.length || !isPlainObject(data)) {
    return undefined;
  }

  const firstPathSegment = path[0];
  if (typeof firstPathSegment !== 'string') {
    return undefined;
  }

  const localizedDocument = data[firstPathSegment];
  if (!isPlainObject(localizedDocument)) {
    return undefined;
  }

  return Object.entries(localizedDocument).find(([, localizedValue]) =>
    containsReference(localizedValue, value),
  )?.[0];
};

export const createTemplateFallbackHook =
  ({
    fields,
    localized,
    template,
  }: {
    fields: Field[];
    localized: boolean;
    template: string;
  }): FieldHook =>
  async ({ context, data, field, path, req, siblingData, value }) => {
    if (!shouldResolveTemplateFields({ context, req })) {
      return value;
    }

    const groupField = `data_${template}`;
    const fieldName =
      'name' in field && typeof field.name === 'string' ? field.name : '';
    const locale = getEffectiveLocale({
      fieldName,
      req,
      siblingData,
      data,
      path,
      value,
    });
    const cacheKey = [
      template,
      localized ? 'all' : (locale ?? localeCacheKey(req.locale)),
      localeCacheKey(req.fallbackLocale),
    ].join(':');
    const cache = getCache(context);
    let lookup = cache.lookups.get(cacheKey);

    if (!lookup) {
      const lookupLocale = localized ? 'all' : locale;
      const lookupReq = lookupLocale === 'all' ? { ...req } : req;
      lookup = req.payload
        .find({
          collection: 'templates' as never,
          depth: 0,
          fallbackLocale: req.fallbackLocale,
          limit: 1,
          ...(lookupLocale ? { locale: lookupLocale as never } : {}),
          overrideAccess: true,
          pagination: false,
          req: lookupReq,
          select: {
            [groupField]: true,
          },
          where: {
            templateType: {
              equals: template,
            },
          },
        })
        .then(({ docs }) => docs[0] as Record<string, unknown> | undefined);
      cache.lookups.set(cacheKey, lookup);
    }

    const document = await lookup;
    if (!document) {
      if (!cache.warned.has(template)) {
        cache.warned.add(template);
        req.payload.logger.warn(
          `[templatesPlugin] Managed template "${template}" is missing; local field values were returned unchanged.`,
        );
      }
      return value;
    }

    return mergeTemplateValues(fields, value, document[groupField], {
      fallbackLocale: req.fallbackLocale,
      flattenLocalizedValues: isLocalizedRichTextValue({ data, path, value }),
      locale,
    });
  };
