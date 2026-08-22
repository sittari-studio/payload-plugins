import { vi } from 'vitest';

import { SEO_RUNTIME_CONFIG_KEY } from '../src/helpers/config.js';
import type {
  SeoDocument,
  SeoEnabledPluginConfig,
  SeoPayload,
} from '../src/types.js';

export const releaseSettings: SeoDocument = {
  siteName: 'Example Site',
  titleTemplate: '%s | Example Site',
  defaultDescription: 'Default site description',
  defaultRobots: { mode: 'index-follow' },
  defaultOpenGraphImage: { url: 'https://example.com/media/default-og.jpg' },
  defaultOpenGraphType: 'website',
  defaultTwitterCard: 'summary_large_image',
  defaultTwitterSite: '@example',
  defaultTwitterCreator: '@example-author',
  globalSchemas: [
    {
      templateId: 'organization',
      name: 'Organization',
      schema: { '@type': 'Organization', name: 'Example Organization' },
    },
  ],
};

export const releasePages = {
  defaults: {
    id: 'defaults',
    _status: 'published',
    slug: 'page-with-defaults',
    title: 'Page With Defaults',
    description: 'Mapped document description',
  },
  noindex: {
    id: 'noindex',
    _status: 'published',
    slug: 'page-with-noindex',
    title: 'Page With Noindex',
    seo: { robots: { mode: 'noindex-follow' } },
  },
  manualCanonical: {
    id: 'manual',
    _status: 'published',
    slug: 'page-with-manual-canonical',
    title: 'Manual Canonical',
    seo: {
      canonical: {
        mode: 'manual',
        url: 'https://example.com/preferred-canonical-page',
      },
    },
  },
  externalCanonical: {
    id: 'external',
    _status: 'published',
    slug: 'page-with-external-canonical',
    title: 'External Canonical',
    seo: {
      canonical: {
        mode: 'manual',
        url: 'https://external.example/original-article',
      },
    },
  },
  canonicalNone: {
    id: 'none',
    _status: 'published',
    slug: 'page-with-canonical-none',
    title: 'Canonical None',
    seo: { canonical: { mode: 'none' } },
  },
  localizedEn: {
    id: 'localized',
    _status: 'published',
    slug: 'localized-page',
    title: 'Localized Page',
  },
  localizedFr: {
    id: 'localized',
    _status: 'published',
    slug: 'page-localisee',
    title: 'Page localisée',
  },
} satisfies Record<string, SeoDocument>;

export const releaseConfig = (): SeoEnabledPluginConfig => ({
  collections: {
    pages: {
      fields: { title: 'title', description: 'description', image: 'image' },
    },
  },
  siteUrl: 'https://example.com',
  media: {
    collection: 'media',
    resolveMediaUrl: ({ media }) => media.url as string | null,
  },
  resolveChunkUrl: ({ locale, page }) =>
    `https://example.com/sitemaps/${locale}/${page}.xml`,
  resolveUrl: ({ document }) =>
    typeof document.slug === 'string' ? `/${document.slug}` : null,
  hreflang: { xDefaultLocale: 'en' },
});

type ReleasePayloadOptions = {
  fr?: SeoDocument;
  settings?: SeoDocument;
};

/** A deliberately small Payload boundary fake: all SEO resolution still uses public plugin APIs. */
export const releasePayload = (
  options: ReleasePayloadOptions = {},
): SeoPayload => {
  const config = releaseConfig();
  const fr = options.fr ?? releasePages.localizedFr;
  const byId = new Map<string, SeoDocument>(
    Object.values(releasePages).map((page) => [String(page.id), page]),
  );
  byId.set('localized', releasePages.localizedEn);
  return {
    config: {
      custom: { [SEO_RUNTIME_CONFIG_KEY]: config },
      localization: { locales: ['en', 'fr'] },
    },
    findGlobal: vi.fn(async () => options.settings ?? releaseSettings),
    findByID: vi.fn(async ({ id, locale }: Record<string, unknown>) =>
      locale === 'fr' && id === 'localized' ? fr : (byId.get(String(id)) ?? {}),
    ),
    find: vi.fn(async ({ collection, locale }: Record<string, unknown>) => {
      if (collection !== 'pages') return { docs: [], totalDocs: 0 };
      const docs =
        locale === 'fr'
          ? [fr]
          : [
              releasePages.defaults,
              releasePages.noindex,
              releasePages.manualCanonical,
              releasePages.externalCanonical,
              releasePages.canonicalNone,
              releasePages.localizedEn,
            ];
      return { docs, totalDocs: docs.length };
    }),
  };
};
