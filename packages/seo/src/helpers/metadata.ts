import type { ResolvedSeoMetadata, SeoDocument, SeoPayload } from '../types.js';
import { resolveSeoNames } from '../plugin.js';
import { resolveSeoMetadataCore } from '../resolvers/metadata.js';
import {
  isPublicSeoDocument,
  resolveCanonicalRobotsSeo,
} from '../resolvers/effective.js';
import {
  loadDocumentWithoutFallback,
  loadSettingsWithoutFallback,
} from '../utils/locale.js';
import { getSeoRuntimeConfig } from './config.js';

type DocumentInput =
  | { document: SeoDocument; id?: never }
  | { document?: never; id: string | number };

const getLocales = (payload: SeoPayload, activeLocale: string): string[] => {
  const configured = payload.config?.localization?.locales ?? [];
  const locales = configured
    .map((locale) => (typeof locale === 'string' ? locale : locale.code))
    .filter((locale): locale is string => Boolean(locale));
  return [...new Set([...(activeLocale ? [activeLocale] : []), ...locales])];
};

/** Shared translation eligibility used by metadata and XML sitemap alternates. */
export const resolveSeoAlternates = async ({
  payload,
  collection,
  locale,
  document,
  config,
  names,
  settings,
}: {
  payload: SeoPayload;
  collection: string;
  locale: string;
  document: SeoDocument;
  config: NonNullable<ReturnType<typeof getSeoRuntimeConfig>>;
  names: ReturnType<typeof resolveSeoNames>;
  settings: SeoDocument;
}): Promise<Record<string, string>> => {
  const id = document.id;
  if (typeof id !== 'string' && typeof id !== 'number') return {};
  const alternates: Record<string, string> = {};
  for (const alternateLocale of getLocales(payload, locale)) {
    try {
      const alternateDocument =
        alternateLocale === locale
          ? document
          : await loadDocumentWithoutFallback({
              payload,
              collection,
              id,
              locale: alternateLocale,
            });
      const effective = await resolveCanonicalRobotsSeo({
        collection,
        config,
        document: alternateDocument,
        locale: alternateLocale,
        names,
        settings,
      });
      if (
        isPublicSeoDocument(alternateDocument) &&
        effective.robots.index !== 'noindex' &&
        effective.canonical.url &&
        !effective.canonical.external
      )
        alternates[alternateLocale] = effective.canonical.url;
    } catch {
      config.diagnostics?.({
        area: 'metadata',
        collection,
        documentId: id,
        locale: alternateLocale,
        message: 'Translation metadata resolution failed.',
      });
    }
  }
  if (
    config.hreflang?.xDefaultLocale &&
    alternates[config.hreflang.xDefaultLocale]
  )
    alternates['x-default'] = alternates[config.hreflang.xDefaultLocale];
  return alternates;
};

export const resolveSeoMetadata = async ({
  payload,
  collection,
  locale,
  ...input
}: {
  payload: SeoPayload;
  collection: string;
  locale: string;
} & DocumentInput): Promise<ResolvedSeoMetadata> => {
  const config = getSeoRuntimeConfig(payload);
  if (!config?.collections[collection]) return {};
  const names = resolveSeoNames(config.names);
  let document: SeoDocument;
  try {
    document =
      'id' in input
        ? await loadDocumentWithoutFallback({
            payload,
            collection,
            id: input.id!,
            locale,
          })
        : input.document;
    const settings = await loadSettingsWithoutFallback({
      payload,
      slug: names.settingsGlobal,
      locale,
    });
    const result = await resolveSeoMetadataCore({
      collection,
      config,
      document,
      locale,
      names,
      settings,
    });
    const alternates = await resolveSeoAlternates({
      payload,
      collection,
      locale,
      document,
      config,
      names,
      settings,
    });
    return Object.keys(alternates).length ? { ...result, alternates } : result;
  } catch {
    config.diagnostics?.({
      area: 'metadata',
      collection,
      locale,
      message: 'Metadata resolution failed.',
    });
    return {};
  }
};
