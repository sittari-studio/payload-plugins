# Public API contract

The API names and type shapes below are the v1 public contract. Framework-neutral
exports and public types are exported from the package root and types subpath.
Next.js helpers are exported from the package next subpath.

## Plugin

~~~ts
seoPlugin({
  siteUrl: process.env.SITE_URL!,
  collections: {
    pages: {
      schemaType: 'WebPage',
      fields: {
        title: 'title',
        description: 'excerpt',
        image: 'heroImage',
      },
      schema: {
        headline: 'title',
        description: 'excerpt',
      },
      sitemap: {
        enabled: true,
        fields: ['slug'],
      },
    },
  },
  media: {
    collection: 'media',
    resolveMediaUrl: ({ media, locale }) => media.url ?? null,
  },
  resolveUrl: ({ collection, document, locale }) => {
    if (collection === 'pages') return locale === 'en'
      ? '/about'
      : '/es/acerca-de'
    return null
  },
  resolveChunkUrl: ({ collection, locale, page }) =>
    'https://example.com/sitemaps/' + collection + '/' + locale + '/' + page + '.xml',
})
~~~

SeoPluginConfig must include:

| Property | Requirement |
| --- | --- |
| enabled | Optional, defaults to true. |
| collections | Required non-empty mapping of enabled collection slugs to collection SEO settings. |
| siteUrl | Required immutable HTTP(S) origin, normally supplied from the host environment. |
| media | Required plugin-level upload collection and public media URL resolver. A collection may override only the upload collection. |
| resolveUrl | Required top-level document URL resolver. |
| resolveChunkUrl | Required top-level resolver for absolute sitemap chunk URLs. |
| access | Optional overrides for SEO fields, settings Global, and redirects collection. |
| names | Optional generated Global, collection, and SEO group names, subject to collision checks. |
| robots | Optional developer-controlled sitemap URL resolver for generated robots.txt. |

A collection entry includes its default schema type, optional localized document
field mappings, optional schema mappings, optional last-modified resolver, and
optional SEO field access override. Its sitemap.enabled option defaults to true.
When sitemap.fields is present, it must list every document field path used by
resolveUrl and lastModified; the sitemap query selects only those paths plus
updatedAt.
No collection-specific URL resolver is permitted; the shared top-level resolver
receives the collection slug.

## Resolver contracts

~~~ts
type ResolveDocumentUrl = (input: {
  collection: string
  document: Record<string, unknown>
  locale: string
}) => null | string | Promise<null | string>

type ResolveLastModified = (input: {
  collection: string
  document: Record<string, unknown>
  locale: string
}) => Date | null | string | Promise<Date | null | string>

type ResolveMediaUrl = (input: {
  media: Record<string, unknown>
  locale: string
}) => null | string | Promise<null | string>

type ResolveSitemapChunkUrl = (input: {
  collection: string
  locale: string
  page: number
}) => string | Promise<string>
~~~

ResolveDocumentUrl returns a site-relative path or null. It must not invent a
locale or fall back to a different locale. A caller combines a valid relative
path with the configured site URL before emitting an absolute URL.

ResolveMediaUrl receives a populated document from the configured Payload upload
collection and returns an absolute public URL or null. It must not expose a
private, unavailable, or cross-locale asset.

Mappings are simple dot paths into the selected document. They are read using
the active locale and do not support arbitrary executable expressions in v1.

## Framework-neutral helpers

~~~ts
resolveSeoMetadata({ payload, collection, document, locale })
resolveSeoMetadata({ payload, collection, id, locale })
renderSchemaJsonLd({ payload, collection, document, locale })
findSeoRedirect({ payload, sourcePath })
renderRobotsTxt({ payload, locale })
renderSitemapXml({ payload, collection, locale, page })
renderSitemapIndexXml({ payload })
~~~

All document-oriented helpers accept either a loaded document or its identifier.
Identifier input causes the helper to load only the published version. V1
exposes no public draft-preview option; Admin previews use the current edit
state without calling public helpers.

resolveSeoMetadata returns a normalized object with optional title,
description, canonical URL, robots directives, Open Graph values, Twitter/X
values, alternate locale URLs, and schema object. Optional values are absent,
not empty strings.

renderSchemaJsonLd returns null when no valid schema can be formed. Otherwise
it returns a serializable object for application-controlled script rendering;
it must not inject a script tag or unsafely serialize HTML itself.

findSeoRedirect returns null or an enabled redirect result containing its
destination and 301 or 302 status. It never performs the redirect.

XML and robots helpers return text only. The application route supplies its
content type, cache policy, and HTTP status.

## Next.js App Router adapter

~~~ts
resolveNextMetadata({ payload, collection, document, locale })
~~~

The adapter returns a Next.js Metadata-compatible object. It maps only values
that are valid in the normalized result and omits unavailable fields. The
application can return it directly from generateMetadata.

The package must not import Next.js from the root entry point. The next subpath
returns a structurally compatible Metadata object without a Next.js runtime
import. Next.js is an optional peer dependency only if its types are imported.

## Stable output rules

- Helpers never create routes, make redirects, or emit HTTP headers.
- Helpers omit invalid/unresolved values instead of throwing for ordinary
  content defects.
- Helpers expose no document draft in v1.
- No public result uses a fallback locale.
- Schema raw override is returned as the complete schema, never merged.
