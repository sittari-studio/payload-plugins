import type { Config } from 'payload';
import { describe, expect, it } from 'vitest';

import { permalinkDisplayPath, permalinkPlugin } from '../src/index.js';
import { formatPermalinkSlug } from '../src/slug.js';

const baseConfig = (): Config =>
  ({
    collections: [
      {
        slug: 'pages',
        admin: { useAsTitle: 'title' },
        fields: [{ name: 'title', type: 'text' }],
      },
    ],
    localization: {
      defaultLocale: 'en',
      locales: ['en', 'uk'],
    },
  }) as unknown as Config;

const makeReq = (overrides: Record<string, unknown> = {}) => {
  const req = { context: {}, ...overrides };
  return req as never;
};

const resolvePath = async ({
  locale,
  prefix,
}: {
  locale: 'en' | 'uk';
  prefix: string;
}) => {
  const config = permalinkPlugin({
    collections: { pages: { prefix } },
    localePrefix: 'as-needed',
    siteUrl: 'https://example.com',
  })(baseConfig()) as Config;
  const pages = config.collections?.find(({ slug }) => slug === 'pages');
  const hook = pages?.hooks?.beforeChange?.at(-1);

  return hook?.({
    collection: pages as never,
    context: {},
    data: { slug: '__home' },
    operation: 'create',
    req: makeReq({ locale, payload: {} }),
  });
};

describe('__home permalink sentinel', () => {
  it('survives slug normalization unchanged', () => {
    expect(formatPermalinkSlug('__home')).toBe('__home');
    expect(formatPermalinkSlug('__home', 'uk')).toBe('__home');
  });

  it('maps an empty-prefix collection to the locale root', async () => {
    expect((await resolvePath({ locale: 'en', prefix: '' }))?.path).toBe('/');
    expect((await resolvePath({ locale: 'uk', prefix: '' }))?.path).toBe('/uk');
  });

  it('maps a prefixed collection to its prefix root', async () => {
    expect((await resolvePath({ locale: 'en', prefix: 'blog' }))?.path).toBe(
      '/blog',
    );
  });

  it('shows the root in the provisional permalink display', () => {
    expect(permalinkDisplayPath(null, '__home')).toBe('/');
    expect(permalinkDisplayPath(null, '__home', 'blog')).toBe('/blog');
  });
});
