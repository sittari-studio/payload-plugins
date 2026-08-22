import { canAccessAdmin, type Endpoint, type Field } from 'payload';

import { resolveSeoPreview } from '../helpers/preview.js';
import { getSeoRuntimeConfig } from '../helpers/config.js';
import { resolveSeoNames } from '../plugin.js';
import {
  SEO_PLUGIN_MARKER,
  type SeoDocument,
  type SeoPayload,
} from '../types.js';
import { isPlainJsonObject } from '../utils/validation.js';

const object = (value: unknown): SeoDocument | undefined =>
  isPlainJsonObject(value) ? value : undefined;

const findField = (
  fields: readonly Field[] | undefined,
  name: string,
): Field | undefined => {
  for (const field of fields ?? []) {
    if ('name' in field && field.name === name) return field;
    if ('fields' in field && Array.isArray(field.fields)) {
      const found = findField(field.fields, name);
      if (found) return found;
    }
    if (field.type === 'tabs') {
      for (const tab of field.tabs) {
        const found = findField(tab.fields, name);
        if (found) return found;
      }
    }
  }
  return undefined;
};

const merge = (base: SeoDocument, overlay: SeoDocument): SeoDocument =>
  Object.entries(overlay).reduce<SeoDocument>(
    (result, [key, value]) => {
      const inherited = result[key];
      result[key] =
        isPlainJsonObject(inherited) && isPlainJsonObject(value)
          ? merge(inherited, value)
          : value;
      return result;
    },
    { ...base },
  );

const relationId = (value: unknown): string | number | undefined =>
  typeof value === 'string' || typeof value === 'number' ? value : undefined;

const readPath = (document: SeoDocument, path: string): unknown =>
  path
    .split('.')
    .filter(Boolean)
    .reduce<unknown>(
      (value, segment) =>
        value !== null && typeof value === 'object' && !Array.isArray(value)
          ? (value as SeoDocument)[segment]
          : undefined,
      document,
    );

const writePath = (
  document: SeoDocument,
  path: string,
  value: unknown,
): void => {
  const segments = path.split('.').filter(Boolean);
  if (!segments.length) return;
  let target: SeoDocument = document;
  for (const segment of segments.slice(0, -1)) {
    const current = target[segment];
    if (!isPlainJsonObject(current)) target[segment] = {};
    target = target[segment] as SeoDocument;
  }
  target[segments.at(-1)!] = value;
};

/** Payload Admin serializes upload fields as IDs. Resolve only the preview image
 * inputs so the configured media URL callback receives the media document it expects. */
const hydratePreviewMedia = async ({
  collection,
  config,
  document,
  locale,
  req,
}: {
  collection: string;
  config: ReturnType<typeof getSeoRuntimeConfig>;
  document: SeoDocument;
  locale: string;
  req: any;
}): Promise<SeoDocument> => {
  if (!config) return document;
  const mediaCollection =
    config.collections[collection]?.media?.collection ??
    config.media.collection;
  const paths = ['seo.openGraph.image', 'seo.twitter.image'];
  const mappedImage = config.collections[collection]?.fields?.image;
  if (mappedImage) paths.push(mappedImage);

  await Promise.all(
    paths.map(async (path) => {
      const id = relationId(readPath(document, path));
      if (id === undefined) return;
      try {
        const media = await (req.payload as SeoPayload).findByID({
          collection: mediaCollection,
          id,
          locale,
          fallbackLocale: false,
          depth: 0,
          overrideAccess: false,
          req,
          user: req.user,
        });
        writePath(document, path, media);
      } catch {
        // Keep the unresolved ID. The shared resolver will omit it safely.
      }
    }),
  );
  return document;
};

const localeIsConfigured = (payload: SeoPayload, locale: string): boolean => {
  const configured = payload.config?.localization?.locales;
  // Payload has no locale registry when localization is disabled. In that
  // mode the host may use its own fixed locale label, so only validate against
  // a registry when one actually exists.
  if (!configured?.length) return true;
  return configured.some(
    (item) => (typeof item === 'string' ? item : item.code) === locale,
  );
};

const hasPreviewAccess = async (
  req: any,
  collection: string,
  seoField: string,
  document?: SeoDocument,
): Promise<boolean> => {
  const config = req.payload.config?.collections?.find(
    (candidate: any) => candidate.slug === collection,
  );
  if (!config) return false;
  const collectionAccess = config.access?.read;
  if (typeof collectionAccess === 'function') {
    const allowed = await collectionAccess({ req });
    // A query is safe only when an ID read below enforces it. Never use it to
    // authorize an unsaved create preview.
    if (allowed !== true && (!document || allowed === false)) return false;
  }
  const field = findField(config.fields, seoField) as any;
  const fieldAccess = field?.access?.read;
  if (
    typeof fieldAccess === 'function' &&
    (await fieldAccess({
      req,
      doc: document,
      data: document,
      siblingData: document,
    })) !== true
  )
    return false;
  return true;
};

/** Resolves an authenticated Admin form's unsaved values with the production SEO resolver. */
export const createSeoPreviewEndpoint = (
  collection: string,
): Omit<Endpoint, 'root'> => ({
  path: '/seo-preview',
  method: 'post',
  handler: async (req) => {
    if (!req.user)
      return Response.json({ message: 'Unauthorized' }, { status: 401 });
    try {
      await canAccessAdmin({ req });
    } catch {
      return Response.json({ message: 'Forbidden' }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await req.json?.();
    } catch {
      return Response.json(
        { message: 'Invalid preview request.' },
        { status: 400 },
      );
    }

    const input = object(body);
    const document = object(input?.document);
    const locale = typeof input?.locale === 'string' ? input.locale : undefined;
    if (
      !document ||
      locale === undefined ||
      !localeIsConfigured(req.payload as unknown as SeoPayload, locale)
    )
      return Response.json(
        { message: 'Invalid preview request.' },
        { status: 400 },
      );

    const config = getSeoRuntimeConfig(req.payload as unknown as SeoPayload);
    if (!config?.collections[collection])
      return Response.json({ message: 'Not found' }, { status: 404 });
    const names = resolveSeoNames(config.names);
    const id = document.id;
    if (id !== undefined && typeof id !== 'string' && typeof id !== 'number')
      return Response.json(
        { message: 'Invalid preview request.' },
        { status: 400 },
      );

    let persisted: SeoDocument | undefined;
    if (id !== undefined) {
      try {
        // Admin previews must be able to resolve a draft-only document, but the
        // Local API still applies the current user's collection access rules.
        persisted = await (req.payload as unknown as SeoPayload).findByID({
          collection,
          id,
          locale,
          fallbackLocale: false,
          draft: true,
          depth: 0,
          overrideAccess: false,
          req,
          user: req.user,
        });
      } catch {
        return Response.json({ message: 'Forbidden' }, { status: 403 });
      }
    }
    if (!(await hasPreviewAccess(req, collection, names.seoField, persisted)))
      return Response.json({ message: 'Forbidden' }, { status: 403 });

    const previewDocument = await hydratePreviewMedia({
      collection,
      config,
      document: persisted ? merge(persisted, document) : document,
      locale,
      req,
    });
    return Response.json(
      await resolveSeoPreview({
        payload: req.payload as unknown as SeoPayload,
        collection,
        document: previewDocument,
        locale,
      }),
    );
  },
  custom: { seo: { marker: SEO_PLUGIN_MARKER } },
});
