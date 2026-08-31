import type {
  ResolvedSeoMetadata,
  ResolvedSitemapSeo,
  SeoDocument,
  SeoPayload,
} from '../types.js';
import { resolveSeoNames } from '../plugin.js';
import { projectSeoMetadata } from '../resolvers/metadata.js';
import {
  isPublicSeoDocument,
  resolveCanonicalRobotsSeo,
  resolveEffectiveSeo,
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

const documentKey = (id: string | number): string => `${typeof id}:${id}`;
type RunWithSitemapConcurrency = <T>(task: () => Promise<T>) => Promise<T>;

const isEligibleAlternate = (
  document: SeoDocument,
  effective: ResolvedSitemapSeo,
): boolean =>
  isPublicSeoDocument(document) &&
  effective.robots.index !== 'noindex' &&
  Boolean(effective.canonical.url) &&
  !effective.canonical.external;

const addXDefault = (
  alternates: Record<string, string>,
  xDefaultLocale: string | undefined,
): void => {
  if (xDefaultLocale && alternates[xDefaultLocale])
    alternates['x-default'] = alternates[xDefaultLocale];
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
  effective: activeEffective,
}: {
  payload: SeoPayload;
  collection: string;
  locale: string;
  document: SeoDocument;
  config: NonNullable<ReturnType<typeof getSeoRuntimeConfig>>;
  names: ReturnType<typeof resolveSeoNames>;
  settings: SeoDocument;
  /** Reuse the active-locale decision when the caller has already resolved it. */
  effective?: ResolvedSitemapSeo;
}): Promise<Record<string, string>> => {
  const id = document.id;
  if (typeof id !== 'string' && typeof id !== 'number') return {};
  const alternates: Record<string, string> = {};
  const settingsByLocale = new Map<string, SeoDocument>([[locale, settings]]);
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
      const alternateSettings =
        settingsByLocale.get(alternateLocale) ??
        (await loadSettingsWithoutFallback({
          payload,
          slug: names.settingsGlobal,
          locale: alternateLocale,
        }));
      settingsByLocale.set(alternateLocale, alternateSettings);
      const resolved =
        alternateLocale === locale && activeEffective
          ? activeEffective
          : await resolveCanonicalRobotsSeo({
              collection,
              config,
              document: alternateDocument,
              locale: alternateLocale,
              names,
              settings: alternateSettings,
            });
      if (isEligibleAlternate(alternateDocument, resolved))
        alternates[alternateLocale] = resolved.canonical.url!;
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
  addXDefault(alternates, config.hreflang?.xDefaultLocale);
  return alternates;
};

/** Batch alternate resolution used by sitemap chunks after manifest selection. */
export const resolveSeoAlternatesForSitemap = async ({
  payload,
  collection,
  locale,
  entries,
  config,
  names,
  settings,
  select,
  runWithGlobalSitemapConcurrency,
}: {
  payload: SeoPayload;
  collection: string;
  locale: string;
  entries: ReadonlyArray<{
    document: SeoDocument;
    effective: ResolvedSitemapSeo;
    url: string;
  }>;
  config: NonNullable<ReturnType<typeof getSeoRuntimeConfig>>;
  names: ReturnType<typeof resolveSeoNames>;
  settings: SeoDocument;
  select?: Record<string, true>;
  runWithGlobalSitemapConcurrency?: RunWithSitemapConcurrency;
}): Promise<Map<string, Record<string, string>>> => {
  const ids = [
    ...new Set(
      entries.flatMap((entry) => {
        const id = entry.document.id;
        return typeof id === 'string' || typeof id === 'number' ? [id] : [];
      }),
    ),
  ];
  const locales = getLocales(payload, locale);
  const settingsByLocale = new Map<string, SeoDocument>([[locale, settings]]);
  const documentsByLocale = new Map<string, Map<string, SeoDocument>>();
  const run = <T>(task: () => Promise<T>): Promise<T> =>
    runWithGlobalSitemapConcurrency
      ? runWithGlobalSitemapConcurrency(task)
      : task();

  await Promise.all(
    locales
      .filter((alternateLocale) => alternateLocale !== locale)
      .map((alternateLocale) =>
        run(async () => {
          try {
            const alternateSettings = await loadSettingsWithoutFallback({
              payload,
              slug: names.settingsGlobal,
              locale: alternateLocale,
            });
            settingsByLocale.set(alternateLocale, alternateSettings);
            if (!payload.find || !ids.length) return;
            const result = await payload.find({
              collection,
              locale: alternateLocale,
              fallbackLocale: false,
              draft: false,
              depth: 0,
              limit: ids.length,
              pagination: false,
              sort: 'id',
              where: { id: { in: ids } },
              ...(select ? { select } : {}),
            });
            documentsByLocale.set(
              alternateLocale,
              new Map(
                result.docs.flatMap((document) => {
                  const id = document.id;
                  return typeof id === 'string' || typeof id === 'number'
                    ? [[documentKey(id), document] as const]
                    : [];
                }),
              ),
            );
          } catch {
            config.diagnostics?.({
              area: 'metadata',
              collection,
              locale: alternateLocale,
              message: 'Translation metadata resolution failed.',
            });
          }
        }),
      ),
  );

  const alternatesByDocument = new Map<string, Record<string, string>>();
  for (const entry of entries) {
    const id = entry.document.id;
    if (typeof id !== 'string' && typeof id !== 'number') continue;
    const alternates: Record<string, string> = {};
    for (const alternateLocale of locales) {
      try {
        const alternateDocument =
          alternateLocale === locale
            ? entry.document
            : documentsByLocale.get(alternateLocale)?.get(documentKey(id));
        if (!alternateDocument) continue;
        const alternateEffective =
          alternateLocale === locale
            ? entry.effective
            : await run(() =>
                resolveCanonicalRobotsSeo({
                  collection,
                  config,
                  document: alternateDocument,
                  locale: alternateLocale,
                  names,
                  settings: settingsByLocale.get(alternateLocale) ?? {},
                }),
              );
        if (isEligibleAlternate(alternateDocument, alternateEffective))
          alternates[alternateLocale] =
            alternateLocale === locale
              ? entry.url
              : alternateEffective.canonical.url!;
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
    addXDefault(alternates, config.hreflang?.xDefaultLocale);
    alternatesByDocument.set(documentKey(id), alternates);
  }
  return alternatesByDocument;
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
    const fullEffective = await resolveEffectiveSeo({
      collection,
      config,
      document,
      locale,
      names,
      settings,
    });
    const result = projectSeoMetadata(fullEffective);
    const alternates = await resolveSeoAlternates({
      payload,
      collection,
      locale,
      document,
      config,
      names,
      settings,
      effective: {
        canonical: fullEffective.canonical,
        robots: fullEffective.robots,
      },
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
