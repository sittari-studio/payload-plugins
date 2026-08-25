import type { Config, Field, Payload } from 'payload';
import { describe, expect, it, vi } from 'vitest';

import {
  buildPaginatedPath,
  cleanPathSegment,
  isValidDocumentPath,
  joinPathSegments,
  parsePaginatedPath,
  permalinkDisplayPath,
  permalinkPlugin,
  validateDocumentPath,
} from '../src/index.js';

const findField = (fields: Field[], name: string): Field | undefined => {
  for (const field of fields) {
    if ('name' in field && field.name === name) return field;
    if ('fields' in field && Array.isArray(field.fields)) {
      const nested = findField(field.fields, name);
      if (nested) return nested;
    }
    if (field.type === 'tabs') {
      for (const tab of field.tabs) {
        const nested = findField(tab.fields, name);
        if (nested) return nested;
      }
    }
  }
  return undefined;
};

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

const getPages = (config: Config) => {
  const pages = config.collections?.find(({ slug }) => slug === 'pages');
  if (!pages) throw new Error('Missing pages collection');
  return pages;
};

const createPlugin = (overrides: Record<string, unknown> = {}) => {
  const pluginConfig = {
    collections: { pages: { prefix: '' } },
    siteUrl: 'https://example.com/',
    ...overrides,
  };
  return permalinkPlugin(pluginConfig as never);
};

describe('permalinkPlugin', () => {
  it('adds slug, path, permalink UI, and the route registry', () => {
    const output = createPlugin()(baseConfig()) as Config;
    const pages = output.collections?.find(({ slug }) => slug === 'pages');
    if (!pages) throw new Error('Missing pages collection');

    const slug = findField(pages.fields, 'slug');
    const path = findField(pages.fields, 'path');
    const permalink = findField(pages.fields, 'sittariPermalink');

    expect(slug).toMatchObject({ name: 'slug', type: 'text', localized: true });
    expect(path).toMatchObject({
      name: 'path',
      type: 'text',
      localized: true,
      admin: { hidden: true, readOnly: true },
    });
    expect(path && 'unique' in path ? path.unique : undefined).not.toBe(true);
    expect(path && 'index' in path ? path.index : undefined).not.toBe(true);
    expect(permalink).toMatchObject({
      name: 'sittariPermalink',
      type: 'ui',
      admin: {
        disableListColumn: true,
        components: {
          Field: {
            path: '@sittari/payload-permalink/client#PermalinkField',
            clientProps: {
              pathFieldName: 'path',
              prefix: '',
              siteUrl: 'https://example.com',
              slugFieldName: 'slug',
              slugSourceFieldName: 'title',
            },
          },
        },
      },
    });
    expect(
      output.collections?.some(
        ({ slug: collectionSlug }) => collectionSlug === 'path-routes',
      ),
    ).toBe(true);
  });

  it('uses an existing text slug instead of adding a second one', () => {
    const config = baseConfig();
    config.collections![0]!.fields.push({ name: 'slug', type: 'text' });
    const output = createPlugin()(config) as Config;
    const pages = getPages(output);

    const slugs: Field[] = [];
    const visit = (fields: Field[]) => {
      for (const field of fields) {
        if ('name' in field && field.name === 'slug') slugs.push(field);
        if ('fields' in field && Array.isArray(field.fields))
          visit(field.fields);
      }
    };
    visit(pages.fields);
    expect(slugs).toHaveLength(1);
    expect((slugs[0]?.admin as { hidden?: boolean } | undefined)?.hidden).toBe(
      true,
    );
  });

  it('builds collection-prefixed and locale-prefixed paths', async () => {
    const output = createPlugin({
      collections: { pages: { prefix: 'blog' } },
    })(baseConfig()) as Config;
    const pages = getPages(output);
    const hook = pages.hooks?.beforeChange?.at(-1);

    const english = await hook?.({
      collection: pages as never,
      context: {},
      data: { slug: 'about' },
      operation: 'create',
      req: makeReq({ locale: 'en', payload: {} }),
    });
    const ukrainian = await hook?.({
      collection: pages as never,
      context: {},
      data: { slug: 'pro-nas' },
      operation: 'create',
      req: makeReq({ locale: 'uk', payload: {} }),
    });

    expect(english.path).toBe('/blog/about');
    expect(ukrainian.path).toBe('/uk/blog/pro-nas');
  });

  it('supports always-prefixed locales', async () => {
    const output = createPlugin({ localePrefix: 'always' })(
      baseConfig(),
    ) as Config;
    const pages = getPages(output);
    const hook = pages.hooks?.beforeChange?.at(-1);
    const result = await hook?.({
      collection: pages as never,
      context: {},
      data: { slug: 'about' },
      operation: 'create',
      req: makeReq({ locale: 'en', payload: {} }),
    });

    expect(result.path).toBe('/en/about');
  });

  it('builds hierarchical paths from the parent canonical path', async () => {
    const config = baseConfig();
    config.collections![0]!.fields.push({
      name: 'parent',
      type: 'relationship',
      relationTo: 'pages',
    });
    const output = createPlugin({
      collections: { pages: { parentField: 'parent', prefix: 'docs' } },
    })(config) as Config;
    const pages = getPages(output);
    const hook = pages.hooks?.beforeChange?.at(-1);
    const findByID = vi.fn(async () => ({ path: '/uk/docs/parent' }));
    const result = await hook?.({
      collection: pages as never,
      context: {},
      data: { parent: 1, slug: 'child' },
      operation: 'create',
      req: makeReq({ locale: 'uk', payload: { findByID } }),
    });

    expect(result.path).toBe('/uk/docs/parent/child');
    expect(findByID).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, locale: 'uk', select: { path: true } }),
    );
  });

  it('allows an unresolved slug for drafts but not published writes', async () => {
    const output = createPlugin()(baseConfig()) as Config;
    const pages = getPages(output);
    const beforeOperation = pages.hooks?.beforeOperation?.at(-1);
    const beforeChange = pages.hooks?.beforeChange?.at(-1);
    const context: Record<string, unknown> = {};
    const req = makeReq({ context, locale: 'en', payload: {} });

    const beforeOperationArgs = {
      args: { data: {}, draft: true, req },
      collection: pages as never,
      context,
      operation: 'create',
      req,
    };
    await beforeOperation?.(beforeOperationArgs as never);
    await expect(
      beforeChange?.({
        collection: pages as never,
        context,
        data: {},
        operation: 'create',
        req,
      }),
    ).resolves.toMatchObject({ path: null });

    await expect(
      beforeChange?.({
        collection: pages as never,
        context: {},
        data: {},
        operation: 'create',
        req: makeReq({ locale: 'en', payload: {} }),
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('composes an existing onInit before repair work', async () => {
    const order: string[] = [];
    const config = baseConfig();
    config.onInit = () => {
      order.push('existing');
    };
    const output = createPlugin()(config) as Config;
    const payload = {
      config: output,
      find: vi.fn(async () => ({ docs: [], hasNextPage: false })),
      logger: { error: vi.fn() },
    } as unknown as Payload;

    await output.onInit?.(payload);
    expect(order).toEqual(['existing']);
  });
});

describe('permalink display', () => {
  it('keeps the stored canonical path while the slug is being edited', () => {
    expect(permalinkDisplayPath('/', 'home')).toBe('/');
    expect(permalinkDisplayPath('/blog/one-value', 'changed', 'blog')).toBe(
      '/blog/one-value',
    );
  });

  it('shows a provisional prefixed path before the document has been saved', () => {
    expect(permalinkDisplayPath(null, 'about')).toBe('/about');
    expect(permalinkDisplayPath(null, 'hello-world', 'blog')).toBe(
      '/blog/hello-world',
    );
  });
});

describe('path utilities', () => {
  it('strictly validates document paths', () => {
    expect(isValidDocumentPath('/')).toBe(true);
    expect(isValidDocumentPath('/products/shoes/')).toBe(true);
    for (const path of [
      '',
      'relative',
      '//example.com/path',
      '/path?query=1',
      '/path#fragment',
      '/path\\child',
      '/https://example.com',
      '/path\u0000child',
    ]) {
      expect(validateDocumentPath(path)).not.toBe(true);
    }
  });

  it('cleans and joins path segments', () => {
    expect(cleanPathSegment(' /hello world/ ')).toBe('hello-world');
    expect(joinPathSegments('/uk/', 'category', 'shoes')).toBe(
      '/uk/category/shoes',
    );
    expect(joinPathSegments()).toBe('/');
  });
});

describe('pagination paths', () => {
  it('builds and parses paginated paths', () => {
    expect(buildPaginatedPath('/products', 1)).toBe('/products');
    expect(buildPaginatedPath('/products', 2)).toBe('/products/page/2');
    expect(parsePaginatedPath('/products/page/2')).toEqual({
      basePath: '/products',
      canonicalPath: '/products/page/2',
      isCanonical: true,
      page: 2,
    });
    expect(parsePaginatedPath('/products/page/1')).toEqual({
      basePath: '/products',
      canonicalPath: '/products',
      isCanonical: false,
      page: 1,
    });
  });
});
