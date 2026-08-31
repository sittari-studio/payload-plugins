# Public API

## Plugin configuration

`seoPlugin()` requires `siteUrl`, a non-empty `collections` mapping, `media`,
`resolveUrl`, and `resolveChunkUrl`. Collection entries may configure metadata
field mappings, media, sitemap behavior, access, and
`schemaVariableExclusions`. The same additive exclusion option is available at
plugin level. An exclusion is a dot-path prefix.

Schema templates are not accepted in developer configuration. The removed
schema type, schema mapping, visual-field, breadcrumb, and organization APIs
have no compatibility reader.

```ts
seoPlugin({
  siteUrl: 'https://example.com',
  collections: {
    pages: {
      fields: { title: 'title', description: 'excerpt', image: 'hero' },
      schemaVariableExclusions: ['private', 'internal.notes'],
      sitemap: { fields: ['slug'] },
    },
  },
  schemaVariableExclusions: ['createdBy'],
  media: {
    collection: 'media',
    resolveMediaUrl: ({ media }) => media.url ?? null,
  },
  resolveUrl: ({ document }) =>
    typeof document.slug === 'string' ? `/${document.slug}` : null,
  resolveChunkUrl: ({ collection, locale, page }) =>
    `https://example.com/sitemaps/${collection}/${locale}/${page}.xml`,
});
```

## Schema utilities

The root exports the template/patch types, six `SEO_SCHEMA_STARTERS`, field
discovery, JSON Patch validation/application, variable substitution, template
resolution, and graph composition utilities. `@context` is reserved and is
rejected anywhere in stored template JSON or patches.

`$canonicalUrl` is the explicit variable for a document's resolved canonical
URL. Runtime resolution never overwrites a schema's own `url`; the WebPage,
Article, Product, and FAQPage starters include this variable by default.

The stable output contract remains `ResolvedSeoMetadata.schema` and
`renderSchemaJsonLd()`: one effective schema is returned as a top-level object
with `@context`; multiple schemas use `@graph` under one top-level context.

## Helpers

`resolveSeoMetadata`, `resolveSeoPreview`, `renderSchemaJsonLd`,
`findSeoRedirect`, `renderRobotsTxt`, `renderSitemapXml`, and
`renderSitemapIndexXml` remain framework-neutral. The Next.js adapter remains
available from `@sittari/payload-seo/next`. Locale-bearing reads explicitly set
`fallbackLocale: false`.

Sitemap generation first builds a manifest of published, indexable, same-site
canonicals, then enriches only the requested chunk with `lastmod` and hreflang
links. Canonical URLs are normalized and deduplicated before enrichment. When
two eligible documents resolve to the same canonical, the first document in
the stable `id` sort order wins; this ordering also determines chunk boundaries.
Returning `true` from a collection's `sitemap.exclude` callback omits that
document.
