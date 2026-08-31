import type { ResolvedSitemapSeo, SeoDocument, SeoPayload } from '../types.js';
import { resolveSeoNames } from '../plugin.js';
import {
  resolveCanonicalRobotsSeo,
  resolveSitemapEligibility,
} from '../resolvers/effective.js';
import { isAbsoluteHttpUrl } from '../utils/validation.js';
import { isSameSiteUrl, normalizeCanonicalUrl } from '../utils/urls.js';
import { getSeoRuntimeConfig } from './config.js';
import { resolveSeoAlternatesForSitemap } from './metadata.js';

const PAGE_SIZE = 25_000;
const RESOLUTION_CONCURRENCY = 16;
const INDEX_MANIFEST_CONCURRENCY = 4;
const SITEMAP_SORT = 'id';

const createLimiter = (limit: number) => {
  let active = 0;
  const waiters: Array<() => void> = [];
  const acquire = (): Promise<void> => {
    if (active < limit) {
      active++;
      return Promise.resolve();
    }
    return new Promise((resolve) => waiters.push(resolve));
  };
  const release = (): void => {
    const next = waiters.shift();
    if (next) next();
    else active--;
  };
  return async <T>(task: () => Promise<T>): Promise<T> => {
    await acquire();
    try {
      return await task();
    } finally {
      release();
    }
  };
};

const runWithGlobalSitemapConcurrency = createLimiter(RESOLUTION_CONCURRENCY);
const escapeXml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;',
      })[character]!,
  );
const xmlDocument = (body: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?>\n${body}`;
const empty = (): string =>
  xmlDocument('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>');
const validDate = (value: unknown): string | undefined => {
  const date =
    value instanceof Date
      ? value
      : typeof value === 'string'
        ? new Date(value)
        : undefined;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : undefined;
};

const sitemapSelect = (
  fields: readonly string[] | undefined,
  seoField: string,
): Record<string, true> | undefined => {
  if (!fields?.length) return undefined;
  return Object.fromEntries(
    [
      ...new Set([
        'updatedAt',
        'id',
        '_status',
        'deletedAt',
        '_deleted',
        seoField,
        ...fields,
      ]),
    ].map((field) => [field, true]),
  );
};

type SitemapEntry = {
  alternates: Record<string, string>;
  lastmod?: string;
  url: string;
};

type SitemapManifestEntry = {
  document: SeoDocument;
  effective: ResolvedSitemapSeo;
  url: string;
};

type SitemapManifest = {
  config: NonNullable<ReturnType<typeof getSeoRuntimeConfig>>;
  entries: SitemapManifestEntry[];
  locale: string;
  names: ReturnType<typeof resolveSeoNames>;
  select?: Record<string, true>;
  settings: SeoDocument;
};

/**
 * Resolves only the canonical manifest. Collisions are keyed by the final
 * normalized canonical URL; the first eligible document in the explicit stable
 * query order wins.
 */
const resolveSitemapManifest = async ({
  payload,
  collection,
  locale,
}: {
  payload: SeoPayload;
  collection: string;
  locale: string;
}): Promise<SitemapManifest | null> => {
  const config = getSeoRuntimeConfig(payload);
  const collectionConfig = config?.collections[collection];
  if (
    !config ||
    !payload.find ||
    !collectionConfig ||
    collectionConfig.sitemap?.enabled === false
  )
    return null;
  const find = payload.find;
  const names = resolveSeoNames(config.names);
  const settings = await runWithGlobalSitemapConcurrency(() =>
    payload.findGlobal({
      slug: names.settingsGlobal,
      locale,
      fallbackLocale: false,
      draft: false,
    }),
  );
  const select = sitemapSelect(
    collectionConfig.sitemap?.fields,
    names.seoField,
  );
  const sourceQuery = {
    collection,
    locale,
    fallbackLocale: false,
    draft: false,
    depth: 0,
    limit: PAGE_SIZE,
    page: 1,
    sort: SITEMAP_SORT,
    ...(select ? { select } : {}),
  };
  const firstPage = await runWithGlobalSitemapConcurrency(() =>
    find(sourceQuery),
  );
  const totalDocs = firstPage.totalDocs ?? firstPage.docs.length;
  const entries: SitemapManifestEntry[] = [];
  const seen = new Set<string>();
  for (
    let rawPage = 1;
    rawPage <= Math.ceil(totalDocs / PAGE_SIZE);
    rawPage++
  ) {
    const result =
      rawPage === 1
        ? firstPage
        : await runWithGlobalSitemapConcurrency(() =>
            find({ ...sourceQuery, page: rawPage }),
          );
    const resolved = await mapBounded(
      result.docs,
      RESOLUTION_CONCURRENCY,
      (document) =>
        runWithGlobalSitemapConcurrency(async () => {
          try {
            const input = {
              collection,
              config,
              document,
              locale,
              names,
              settings,
            };
            const effective = await resolveCanonicalRobotsSeo(input);
            if (
              !(await resolveSitemapEligibility({ effective, document, input }))
            )
              return null;
            const url = normalizeCanonicalUrl(
              effective.canonical.url,
              config.url?.trailingSlash ?? 'never',
            );
            if (!url) return null;
            return { document, effective, url };
          } catch {
            config.diagnostics?.({
              area: 'sitemap',
              collection,
              documentId:
                typeof document.id === 'string' ||
                typeof document.id === 'number'
                  ? document.id
                  : undefined,
              locale,
              message: 'Sitemap document resolution failed.',
            });
            return null;
          }
        }),
    );
    for (const entry of resolved) {
      if (!entry) continue;
      if (seen.has(entry.url)) {
        config.diagnostics?.({
          area: 'sitemap',
          collection,
          locale,
          message: 'Sitemap canonical collision omitted.',
        });
        continue;
      }
      seen.add(entry.url);
      entries.push(entry);
    }
  }
  return { config, entries, locale, names, select, settings };
};

const enrichSitemapEntries = async ({
  payload,
  collection,
  manifest,
  entries,
}: {
  payload: SeoPayload;
  collection: string;
  manifest: SitemapManifest;
  entries: readonly SitemapManifestEntry[];
}): Promise<SitemapEntry[]> => {
  if (!entries.length) return [];
  const alternatesByDocument = await resolveSeoAlternatesForSitemap({
    payload,
    collection,
    locale: manifest.locale,
    entries,
    config: manifest.config,
    names: manifest.names,
    settings: manifest.settings,
    select: manifest.select,
    runWithGlobalSitemapConcurrency,
  });
  const collectionConfig = manifest.config.collections[collection];
  const resolved = await mapBounded(entries, RESOLUTION_CONCURRENCY, (entry) =>
    runWithGlobalSitemapConcurrency(async (): Promise<SitemapEntry | null> => {
      try {
        let lastmod = validDate(entry.document.updatedAt);
        if (collectionConfig?.lastModified)
          lastmod = validDate(
            await collectionConfig.lastModified({
              collection,
              document: entry.document,
              locale: manifest.locale,
            }),
          );
        const id = entry.document.id;
        const alternates =
          typeof id === 'string' || typeof id === 'number'
            ? (alternatesByDocument.get(`${typeof id}:${id}`) ?? {})
            : {};
        return {
          url: entry.url,
          ...(lastmod ? { lastmod } : {}),
          alternates,
        };
      } catch {
        manifest.config.diagnostics?.({
          area: 'sitemap',
          collection,
          documentId:
            typeof entry.document.id === 'string' ||
            typeof entry.document.id === 'number'
              ? entry.document.id
              : undefined,
          locale: manifest.locale,
          message: 'Sitemap document resolution failed.',
        });
        return null;
      }
    }),
  );
  return resolved.filter((entry): entry is SitemapEntry => entry !== null);
};

const renderEntry = (entry: SitemapEntry): string => {
  const alternates = Object.entries(entry.alternates)
    .map(
      ([locale, url]) =>
        `<xhtml:link rel="alternate" hreflang="${escapeXml(locale)}" href="${escapeXml(url)}"/>`,
    )
    .join('');
  return `<url><loc>${escapeXml(entry.url)}</loc>${entry.lastmod ? `<lastmod>${entry.lastmod}</lastmod>` : ''}${alternates}</url>`;
};

export const renderSitemapXml = async ({
  payload,
  collection,
  locale,
  page,
}: {
  payload: SeoPayload;
  collection: string;
  locale: string;
  page: number;
}): Promise<string> => {
  if (!Number.isInteger(page) || page < 1) return empty();
  try {
    const manifest = await resolveSitemapManifest({
      payload,
      collection,
      locale,
    });
    if (!manifest) return empty();
    const selectedEntries = manifest.entries.slice(
      (page - 1) * PAGE_SIZE,
      page * PAGE_SIZE,
    );
    const chunk = await enrichSitemapEntries({
      payload,
      collection,
      manifest,
      entries: selectedEntries,
    });
    const xhtml = chunk.some((entry) => Object.keys(entry.alternates).length);
    return xmlDocument(
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${xhtml ? ' xmlns:xhtml="http://www.w3.org/1999/xhtml"' : ''}>${chunk.map(renderEntry).join('')}</urlset>`,
    );
  } catch {
    const config = getSeoRuntimeConfig(payload);
    config?.diagnostics?.({
      area: 'sitemap',
      collection,
      locale,
      message: 'Sitemap resolution failed.',
    });
    return empty();
  }
};

const mapBounded = async <T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results: R[] = [];
  results.length = items.length;
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await mapper(items[index]!);
      }
    }),
  );
  return results;
};

export const renderSitemapIndexXml = async ({
  payload,
}: {
  payload: SeoPayload;
}): Promise<string> => {
  const config = getSeoRuntimeConfig(payload);
  if (!config || !payload.find)
    return xmlDocument(
      '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>',
    );
  const locales =
    payload.config?.localization?.locales
      ?.map((locale) => (typeof locale === 'string' ? locale : locale.code))
      .filter((locale): locale is string => Boolean(locale)) ?? [];
  const effectiveLocales = locales.length ? locales : [''];
  const work: Array<{ collection: string; locale: string }> = [];
  for (const [collection, collectionConfig] of Object.entries(
    config.collections,
  )) {
    if (collectionConfig.sitemap?.enabled === false) continue;
    for (const locale of effectiveLocales) work.push({ collection, locale });
  }
  const rendered = await mapBounded(
    work,
    INDEX_MANIFEST_CONCURRENCY,
    async ({ collection, locale }) => {
      try {
        const manifest = await resolveSitemapManifest({
          payload,
          collection,
          locale,
        });
        if (!manifest) return '';
        const entries: string[] = [];
        for (
          let page = 1;
          page <= Math.ceil(manifest.entries.length / PAGE_SIZE);
          page++
        ) {
          const resolvedUrl = await runWithGlobalSitemapConcurrency(() =>
            Promise.resolve(
              config.resolveChunkUrl({
                collection,
                locale,
                page,
              }),
            ),
          );
          if (!isAbsoluteHttpUrl(resolvedUrl)) continue;
          const url = resolvedUrl.trim();
          const normalizedUrl = isSameSiteUrl(config.siteUrl, url)
            ? normalizeCanonicalUrl(url, config.url?.trailingSlash ?? 'never')
            : url;
          if (normalizedUrl)
            entries.push(
              `<sitemap><loc>${escapeXml(normalizedUrl)}</loc></sitemap>`,
            );
        }
        return entries.join('');
      } catch {
        config.diagnostics?.({
          area: 'sitemap',
          collection,
          locale,
          message: 'Sitemap index chunk resolution failed.',
        });
        return '';
      }
    },
  );
  return xmlDocument(
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rendered.join('')}</sitemapindex>`,
  );
};
