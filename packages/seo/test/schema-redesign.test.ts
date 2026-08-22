import { fieldReducer } from '../node_modules/@payloadcms/ui/dist/forms/Form/fieldReducer.js';
import type { Field, FormState } from 'payload';
import { reduceFieldsToValues } from 'payload/shared';
import { describe, expect, it, vi } from 'vitest';
import {
  applyJsonPatch,
  composeSchemaGraph,
  createSchemaStarter,
  createSchemaValue,
  diffEffectiveSchema,
  discoverSchemaVariables,
  duplicateSchemaEntry,
  hasSameSchemaStructure,
  groupSchemaVariables,
  insertVariableAtCaret,
  parseSchemaImport,
  removeManagedContext,
  removeSchemaEntry,
  renameSchemaProperty,
  reorderSchemaEntry,
  resolveSchemaList,
  substituteSchemaVariables,
  validateJsonPatch,
  validateSchemaObject,
} from '../src/index.js';
import { createSchemaTemplatesEndpoint } from '../src/endpoints/schema-templates.js';
import { payloadArrayRowState } from '../src/admin/schema/payloadArrayState.js';
import {
  isLocalizedSchemaLocale,
  resolveCollectionLabel,
} from '../src/admin/schema/types.js';

describe('editor-managed schema core', () => {
  it('resolves localized plural collection labels and falls back to the slug', () => {
    expect(resolveCollectionLabel('Pages', 'pages', 'uk')).toBe('Pages');
    expect(
      resolveCollectionLabel({ en: 'Pages', uk: 'Сторінки' }, 'pages', 'uk-UA'),
    ).toBe('Сторінки');
    expect(resolveCollectionLabel({ en: 'Pages' }, 'pages', 'uk')).toBe(
      'pages',
    );
    expect(resolveCollectionLabel(undefined, 'pages', 'en')).toBe('pages');
  });

  it('only enters localized schema mode when Payload localization is enabled', () => {
    expect(isLocalizedSchemaLocale({ defaultLocale: 'en', locale: 'uk' })).toBe(
      false,
    );
    expect(
      isLocalizedSchemaLocale({
        defaultLocale: 'en',
        locale: 'uk',
        localization: {},
      }),
    ).toBe(true);
    expect(
      isLocalizedSchemaLocale({
        defaultLocale: 'en',
        locale: 'en',
        localization: {},
      }),
    ).toBe(false);
  });

  it('discovers eligible paths and applies automatic plus additive exclusions', () => {
    const fields: Field[] = [
      { name: 'title', type: 'text', label: 'Title' },
      {
        name: 'details',
        type: 'group',
        fields: [
          { name: 'summary', type: 'textarea' },
          { name: 'secret', type: 'text' },
        ],
      },
      {
        name: 'layout',
        type: 'blocks',
        blocks: [{ slug: 'hero', fields: [{ name: 'heading', type: 'text' }] }],
      },
      { name: 'seo', type: 'group', fields: [{ name: 'title', type: 'text' }] },
      { name: 'display', type: 'ui', admin: {} },
    ];
    expect(
      discoverSchemaVariables({
        collection: 'pages',
        fields,
        exclusions: ['details.secret'],
      }).map(({ path }) => path),
    ).toEqual(['title', 'details.summary']);
  });

  it('marks grouped global suggestions unavailable across all collections', () => {
    const grouped = groupSchemaVariables({
      pages: [
        { collection: 'pages', path: 'title', label: 'Title' },
        { collection: 'pages', path: 'hero', label: 'Hero' },
      ],
      posts: [{ collection: 'posts', path: 'title', label: 'Title' }],
    });
    expect(
      grouped.find((item) => item.path === 'title')?.availableInEveryCollection,
    ).toBe(true);
    expect(
      grouped.find((item) => item.path === 'hero')?.availableInEveryCollection,
    ).toBe(false);
  });

  it('substitutes native values, interpolates strings, escapes dollars, and omits missing containers', () => {
    const document = {
      title: 'Hello',
      count: 2,
      data: { ok: true },
      nil: null,
    };
    expect(
      substituteSchemaVariables(
        {
          native: '$count',
          object: '$data',
          text: 'Title: $title ($count) $data',
          escaped: '$$title',
          nil: '$nil',
          missing: '$nope',
          items: ['$title', '$nope', null],
        },
        document,
      ),
    ).toEqual({
      native: 2,
      object: { ok: true },
      text: 'Title: Hello (2) {"ok":true}',
      escaped: '$title',
      nil: null,
      items: ['Hello', null],
    });
  });

  it('validates and immutably applies RFC 6902-style operations', () => {
    const source = { name: 'Base', nested: { value: 1 }, list: ['a'] };
    const result = applyJsonPatch(source, [
      { op: 'replace', path: '/name', value: 'Changed' },
      { op: 'add', path: '/nested/new', value: true },
      { op: 'add', path: '/list/-', value: 'b' },
      { op: 'remove', path: '/nested/value' },
    ]);
    expect(result).toEqual({
      name: 'Changed',
      nested: { new: true },
      list: ['a', 'b'],
    });
    expect(source).toEqual({ name: 'Base', nested: { value: 1 }, list: ['a'] });
    expect(
      validateJsonPatch([{ op: 'replace', path: '/@context', value: 'bad' }]),
    ).not.toBe(true);
    expect(
      validateJsonPatch([
        { op: 'add', path: '/nested', value: { '@context': 'bad' } },
      ]),
    ).not.toBe(true);
    expect(
      validateJsonPatch([{ op: 'add', path: '/new', value: 'value' }], {
        scalarValuesOnly: true,
        source,
      }),
    ).not.toBe(true);
    expect(
      validateJsonPatch([{ op: 'replace', path: '/missing', value: 'value' }], {
        scalarValuesOnly: true,
        source,
      }),
    ).not.toBe(true);
    expect(
      validateJsonPatch(
        [{ op: 'replace', path: '/nested/value', value: '1' }],
        { scalarValuesOnly: true, source },
      ),
    ).not.toBe(true);
    expect(
      validateJsonPatch([{ op: 'replace', path: '/nested/value', value: 2 }], {
        scalarValuesOnly: true,
        source,
      }),
    ).toBe(true);
    expect(validateSchemaObject({ '@context': 'https://schema.org' })).not.toBe(
      true,
    );
  });

  it('supports recursive editor add, rename, duplicate, reorder, and delete operations', () => {
    expect(createSchemaValue('object')).toEqual({});
    expect(createSchemaValue('array')).toEqual([]);
    const source = { title: 'A', nested: { value: 1 }, list: [true, null] };
    const renamed = renameSchemaProperty(source, 'title', 'headline');
    expect(renamed).toEqual({
      headline: 'A',
      nested: { value: 1 },
      list: [true, null],
    });
    expect(duplicateSchemaEntry(renamed, 0)).toEqual({
      headline: 'A',
      headlineCopy: 'A',
      nested: { value: 1 },
      list: [true, null],
    });
    expect(reorderSchemaEntry(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(removeSchemaEntry(['a', 'b', 'c'], 1)).toEqual(['a', 'c']);
    expect(source).toEqual({
      title: 'A',
      nested: { value: 1 },
      list: [true, null],
    });
  });

  it('clones all six starters and never persists starter metadata', () => {
    for (const starter of [
      'WebPage',
      'Article',
      'Product',
      'Organization',
      'LocalBusiness',
      'FAQPage',
    ] as const) {
      const first = createSchemaStarter(starter);
      const second = createSchemaStarter(starter);
      expect(first['@type']).toBe(starter);
      expect(first).not.toBe(second);
      expect(first).not.toHaveProperty('starter');
    }
  });

  it('imports object JSON, isolates invalid input, and removes plugin-managed context explicitly', () => {
    expect(parseSchemaImport('{bad')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseSchemaImport('[]')).toEqual({ ok: false, reason: 'root' });
    const imported = parseSchemaImport(
      '{"@context":"https://schema.org","@type":"Article","nested":{"@context":"managed","name":"ok"}}',
    );
    expect(imported.ok && imported.hasManagedContext).toBe(true);
    if (imported.ok)
      expect(removeManagedContext(imported.schema)).toEqual({
        '@type': 'Article',
        nested: { name: 'ok' },
      });
  });

  it('inserts filtered variables at the caret without replacing surrounding text', () => {
    expect(insertVariableAtCaret('By $aut today', 'author.name', 7)).toEqual({
      value: 'By $author.name today',
      caret: 15,
    });
    expect(insertVariableAtCaret('Hello world', '$title', 6, 11)).toEqual({
      value: 'Hello $title',
      caret: 12,
    });
  });

  it('diffs objects deterministically, escapes JSON Pointer paths, and replaces arrays as units', () => {
    const base = {
      keep: 1,
      remove: true,
      nested: { 'a/b~c': 'old' },
      list: ['a', 'b'],
    };
    const next = {
      add: null,
      keep: 2,
      nested: { 'a/b~c': 'new' },
      list: ['a', 'c'],
    };
    const patch = diffEffectiveSchema(base, next);
    expect(patch).toEqual([
      { op: 'remove', path: '/remove' },
      { op: 'add', path: '/add', value: null },
      { op: 'replace', path: '/keep', value: 2 },
      { op: 'replace', path: '/list', value: ['a', 'c'] },
      { op: 'replace', path: '/nested/a~1b~0c', value: 'new' },
    ]);
    expect(applyJsonPatch(base, patch)).toEqual(next);
  });

  it('limits localized diffs to scalar changes and detects structural edits', () => {
    const base = { title: 'Base', nested: { count: 1 }, list: ['a'] };
    const localized = {
      title: 'Localized',
      nested: { count: 2 },
      list: ['changed'],
    };
    expect(
      diffEffectiveSchema(base, localized, { scalarValuesOnly: true }),
    ).toEqual([
      { op: 'replace', path: '/nested/count', value: 2 },
      { op: 'replace', path: '/title', value: 'Localized' },
    ]);
    expect(hasSameSchemaStructure(base, localized)).toBe(true);
    expect(hasSameSchemaStructure(base, { ...localized, extra: true })).toBe(
      false,
    );
  });

  it('resolves live global and repeated collection references in the required order', () => {
    const schemas = resolveSchemaList({
      globalSchemas: [
        {
          id: 'global',
          name: 'Site',
          schema: { '@type': 'WebSite', name: 'Base' },
          valueOverrides: [
            { op: 'replace', path: '/name', value: 'Localized' },
          ],
        },
      ],
      globalOverrides: [
        {
          schemaId: 'global',
          overrides: [{ op: 'replace', path: '/name', value: '$siteName' }],
        },
      ],
      templates: [
        {
          id: 'article',
          name: 'Article',
          schema: {
            '@type': 'Article',
            headline: '$title',
            url: '$canonicalUrl',
          },
        },
      ],
      instances: [
        { templateId: 'article' },
        {
          templateId: 'article',
          overrides: [
            { op: 'replace', path: '/headline', value: 'Second: $title' },
          ],
        },
      ],
      documentSchemas: [
        {
          schemaId: 'document',
          name: 'Document',
          schema: { '@type': 'Thing', name: 'Only $title' },
          valueOverrides: [
            { op: 'replace', path: '/name', value: 'Localized $title' },
          ],
        },
      ],
      document: { title: 'Story', siteName: 'Example' },
      canonicalUrl: 'https://example.com/story',
    });
    expect(schemas).toHaveLength(4);
    expect(schemas[0]).toMatchObject({ name: 'Example' });
    expect(schemas[0]).not.toHaveProperty('url');
    expect(schemas[1]).toMatchObject({ url: 'https://example.com/story' });
    expect(schemas[2]).toMatchObject({ headline: 'Second: Story' });
    expect(schemas[3]).toEqual({ '@type': 'Thing', name: 'Localized Story' });
    expect(composeSchemaGraph(schemas)).toEqual({
      '@context': 'https://schema.org',
      '@graph': schemas,
    });
  });

  it('keeps one-schema output compatible and uses a graph for many schemas', () => {
    expect(composeSchemaGraph([{ '@type': 'Thing' }])).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Thing',
    });
    expect(
      composeSchemaGraph([{ '@type': 'Thing' }, { '@type': 'WebPage' }])?.[
        '@graph'
      ],
    ).toHaveLength(2);
  });

  it('isolates invalid or missing instances and reports each omission', () => {
    const onError = vi.fn();
    const schemas = resolveSchemaList({
      globalSchemas: [
        {
          id: 'good-global',
          name: 'Good',
          schema: {
            '@type': 'Organization',
            url: 'https://organization.example',
          },
        },
        {
          id: 'bad-global',
          name: 'Bad',
          schema: { '@type': 'WebSite' },
          valueOverrides: [{ op: 'replace', path: '/missing', value: 'bad' }],
        },
      ],
      templates: [
        {
          id: 'article',
          name: 'Article',
          schema: { '@type': 'Article', headline: '$title' },
        },
      ],
      instances: [{ templateId: 'missing' }, { templateId: 'article' }],
      document: { title: 'Retained' },
      canonicalUrl: 'https://example.com/page',
      onError,
    });
    expect(schemas).toEqual([
      { '@type': 'Organization', url: 'https://organization.example' },
      { '@type': 'Article', headline: 'Retained' },
    ]);
    expect(onError).toHaveBeenCalledWith({
      id: 'bad-global',
      scope: 'global',
      reason: 'invalid',
    });
    expect(onError).toHaveBeenCalledWith({
      id: 'missing',
      scope: 'collection',
      reason: 'missing',
    });
  });

  it('mutates and serializes Payload array rows through the real form reducer', () => {
    let state: FormState = {
      globalSchemas: { disableFormData: false, rows: [], value: 0 },
    };
    state = fieldReducer(state, {
      type: 'ADD_ROW',
      path: 'globalSchemas',
      rowIndex: 0,
      subFieldState: payloadArrayRowState({
        templateId: 'one',
        name: 'One',
        schema: { '@type': 'Thing' },
      }),
    });
    state = fieldReducer(state, {
      type: 'ADD_ROW',
      path: 'globalSchemas',
      rowIndex: 1,
      subFieldState: payloadArrayRowState({
        templateId: 'two',
        name: 'Two',
        schema: { '@type': 'WebPage' },
      }),
    });
    state = fieldReducer(state, {
      type: 'MOVE_ROW',
      path: 'globalSchemas',
      moveFromIndex: 1,
      moveToIndex: 0,
    });
    state = fieldReducer(state, {
      type: 'REPLACE_ROW',
      path: 'globalSchemas',
      rowIndex: 1,
      subFieldState: payloadArrayRowState({
        templateId: 'one',
        name: 'Edited',
        schema: { '@type': 'Article' },
      }),
    });
    state = fieldReducer(state, {
      type: 'REMOVE_ROW',
      path: 'globalSchemas',
      rowIndex: 0,
    });
    expect(reduceFieldsToValues(state, true).globalSchemas).toEqual([
      expect.objectContaining({
        templateId: 'one',
        name: 'Edited',
        schema: { '@type': 'Article' },
      }),
    ]);

    let nested: FormState = {
      collectionSchemas: { disableFormData: false, rows: [], value: 0 },
    };
    nested = fieldReducer(nested, {
      type: 'ADD_ROW',
      path: 'collectionSchemas',
      rowIndex: 0,
      subFieldState: payloadArrayRowState(
        {
          collection: 'pages',
          templates: [
            {
              templateId: 'page',
              name: 'Page',
              schema: { '@type': 'WebPage' },
            },
          ],
        },
        { templates: {} },
      ),
    });
    expect(reduceFieldsToValues(nested, true).collectionSchemas).toEqual([
      expect.objectContaining({
        collection: 'pages',
        templates: [
          expect.objectContaining({ templateId: 'page', name: 'Page' }),
        ],
      }),
    ]);
  });
});

describe('schema template Admin endpoint', () => {
  const request = ({
    fieldRead = true,
    localized = true,
    settingsRead = true,
    user = true,
  } = {}) => {
    const access = {
      admin: vi.fn(async () => true),
      create: vi.fn(async () => true),
      read: vi.fn(async () => ({ tenant: { equals: 'allowed' } })),
    };
    const seoRead = vi.fn(async () => fieldRead);
    const findGlobal = vi.fn(async (options) => {
      if (!settingsRead) throw new Error('denied');
      return {
        globalSchemas: [
          {
            templateId: 'global',
            name: 'Global',
            schema: { '@type': 'Organization' },
          },
        ],
        collectionSchemas: [
          {
            collection: 'pages',
            templates: [
              {
                templateId: 'article',
                name: 'Article',
                schema: { '@type': 'Article' },
              },
            ],
          },
        ],
        options,
      };
    });
    return {
      req: {
        url: localized
          ? 'http://localhost/api/pages/seo-schema-templates?locale=uk'
          : 'http://localhost/api/pages/seo-schema-templates',
        user: user ? { collection: 'users', id: 1 } : undefined,
        payload: {
          collections: {
            users: { config: { access: { admin: vi.fn(async () => true) } } },
          },
          config: {
            admin: { user: 'users' },
            localization: localized
              ? {
                  defaultLocale: 'en',
                  locales: [{ code: 'en' }, { code: 'uk' }],
                }
              : undefined,
            collections: [
              {
                slug: 'pages',
                access,
                fields: [
                  {
                    name: 'seo',
                    type: 'group',
                    access: { read: seoRead },
                    fields: [],
                  },
                ],
              },
            ],
          },
          findGlobal,
        },
      } as any,
      access,
      findGlobal,
      seoRead,
    };
  };

  it('requires authentication before returning template metadata', async () => {
    const endpoint = createSchemaTemplatesEndpoint({
      collection: 'pages',
      seoField: 'seo',
      settingsGlobal: 'seo-settings',
    });
    const { req } = request({ user: false });
    expect((await endpoint.handler(req)).status).toBe(401);
  });

  it('applies collection, SEO-field, and Settings read access and keeps locale explicit', async () => {
    const endpoint = createSchemaTemplatesEndpoint({
      collection: 'pages',
      seoField: 'seo',
      settingsGlobal: 'seo-settings',
    });
    const allowed = request();
    const response = await endpoint.handler(allowed.req);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      defaultLocale: 'en',
      globalSchemas: [{ templateId: 'global' }],
      collectionTemplates: [{ templateId: 'article' }],
    });
    expect(allowed.access.admin).toHaveBeenCalled();
    expect(allowed.access.create).toHaveBeenCalled();
    expect(allowed.access.read).not.toHaveBeenCalled();
    expect(allowed.seoRead).toHaveBeenCalled();
    expect(allowed.findGlobal).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: 'uk',
        fallbackLocale: false,
        overrideAccess: false,
        user: allowed.req.user,
      }),
    );

    const fieldDenied = request({ fieldRead: false });
    expect((await endpoint.handler(fieldDenied.req)).status).toBe(403);
    expect(fieldDenied.findGlobal).not.toHaveBeenCalled();

    const settingsDenied = request({ settingsRead: false });
    expect((await endpoint.handler(settingsDenied.req)).status).toBe(403);
  });

  it('omits locale metadata and accepts no locale parameter when localization is disabled', async () => {
    const endpoint = createSchemaTemplatesEndpoint({
      collection: 'pages',
      seoField: 'seo',
      settingsGlobal: 'seo-settings',
    });
    const allowed = request({ localized: false });
    const response = await endpoint.handler(allowed.req);

    expect(response.status).toBe(200);
    expect(await response.json()).not.toHaveProperty('defaultLocale');
    expect(allowed.findGlobal).toHaveBeenCalledWith(
      expect.objectContaining({ locale: undefined }),
    );
  });
});
