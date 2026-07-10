# Public API

Import server functionality from the package root. Client components are an
internal Payload Admin integration and are available only from the `client`
subpath.

```ts
import {
  findSeoRedirect,
  renderRobotsTxt,
  renderSchemaJsonLd,
  renderSitemapIndexXml,
  renderSitemapXml,
  resolveEffectiveSeo,
  resolveSitemapEligibility,
  resolveSeoMetadata,
  seoPlugin,
} from '@krameri/payload-seo'
```

Types are exported from both the package root and `@krameri/payload-seo/types`.

## `seoPlugin(options)`

The plugin needs these active-mode options:

| Option | Required | Description |
| --- | --- | --- |
| `collections` | Yes | Non-empty mapping of existing Payload collection slugs to `SeoCollectionConfig`. |
| `siteUrl` | Yes | Immutable HTTP(S) site origin, normally supplied by the host environment. |
| `media.collection` | Yes | Existing Payload upload collection used for default SEO images. |
| `media.resolveMediaUrl` | Yes | Resolves a populated media document to an absolute public URL or `null`. |
| `resolveUrl` | Yes | Resolves one document and locale to a site-relative path or `null`. |
| `resolveChunkUrl` | Yes | Resolves a sitemap collection, locale, and page to an absolute URL. |
| `url.trailingSlash` | No | `never` (default) or `always`; applied to every same-site canonical and sitemap URL. |
| `hreflang.xDefaultLocale` | No | Adds `x-default` only when that locale resolves to an eligible URL. |
| `diagnostics` | No | Receives sanitized resolver failure context. |
| `access` | No | Payload access overrides for the Settings Global and redirects collection. |
| `names` | No | Replaces the default SEO field, settings Global, and redirects collection slugs. |
| `robots.resolveSitemapUrls` | No | Returns absolute sitemap URLs appended to generated robots.txt. |

Each `SeoCollectionConfig` requires a `schemaType`: `WebPage`, `Article`,
`Product`, `Organization`, `LocalBusiness`, or `FAQPage`.

Optional collection options are:

- `fields`: maps `title`, `description`, and `image` to document paths. Mapped
  images participate in the Open Graph and X fallback chain.
- `schema`: maps schema properties to dot paths on the document.
- `breadcrumbs`: optional resolver returning `{ name, url }` items. URLs may be
  absolute or site-relative; invalid items are omitted and a `BreadcrumbList`
  is added separately from the document schema.
- `lastModified`: returns the last-modified date used by sitemap output.
- `media.collection`: overrides the plugin-level upload collection for that
  collection's Open Graph and X/Twitter fields.
- `sitemap.enabled`: excludes the collection when set to `false`.
- `sitemap.fields`: fields selected for each sitemap document read. When set,
  include every path used by `resolveUrl`, `lastModified`, and `sitemap.exclude`;
  the callback intentionally receives that same narrow projection.
- `sitemap.exclude`: sync or async host callback for redirects, scheduled
  content, hidden routes, or other publication rules. Return `true` to omit.
- `visualFields`: additional named text, textarea, number, checkbox, select,
  date, or upload fields for the schema editor.
- `access`: additive `read` and `update` field access for the generated SEO
  group.

## Metadata and schema

### `resolveSeoMetadata(input)`

Resolves one selected document into framework-neutral metadata. Pass either a
document you already loaded or its ID:

```ts
const metadata = await resolveSeoMetadata({
  payload,
  collection: 'pages',
  id: pageId,
  locale: 'uk',
})
```

The result has only resolved values:

```ts
type ResolvedSeoMetadata = {
  title?: string
  description?: string
  canonicalUrl?: string
  alternates?: Record<string, string>
  robots?: {
    index?: 'index' | 'noindex'
    follow?: 'follow' | 'nofollow'
    custom?: string[]
  }
  openGraph?: { title?: string; description?: string; image?: string }
  twitter?: {
    title?: string
    description?: string
    image?: string
    card?: 'summary' | 'summary_large_image'
  }
  schema?: Record<string, unknown>
}
```

ID input loads the published document and settings in exactly the requested
locale. It does not enable a draft preview or Payload fallback locale. Missing,
invalid, or unresolvable values are omitted; the helper returns `{}` when it
cannot resolve the document or settings.

All outputs start with `resolveEffectiveSeo`: document field values → global
defaults → page overrides → effective state. `resolveSeoMetadata`, sitemap,
schema, robots, and `resolveSeoPreview` are projections of that state.

`titleTemplate` from Settings is applied when it contains exactly one `%s`.
Document title and description overrides take precedence over configured
document-field mappings and site defaults. A valid document `rawJson` schema
override replaces generated schema entirely.

### `resolveSeoPreview(input)`

This server-backed helper accepts the same `payload`, `collection`, `locale`,
and `id`/`document` inputs as `resolveSeoMetadata`. It projects the shared
effective state into preview title, description, canonical URL, image, and
robots values, so host-owned preview endpoints can match rendered metadata.

### Robots and canonicals

Page `seo.robots.mode` defaults to `inherit`; it never silently sets index/follow.
Modes are `inherit`, `index-follow`, `noindex-follow`, `index-nofollow`,
`noindex-nofollow`, and `custom`. Untouched pages therefore use the localized
Settings `defaultRobots` mode. Custom mode preserves supported directives in
framework-neutral metadata and the Next adapter: `noarchive`, `nosnippet`,
`noimageindex`, `notranslate`, `max-snippet`, `max-video-preview`,
`max-image-preview`, `unavailable_after`, plus `noindex` and `nofollow`.

Canonical modes are `auto`, `manual`, and `none`. Manual values must be absolute
HTTP(S) URLs without query strings or fragments. Same-site manual canonicals are
normalized with the configured trailing-slash policy. An external manual
canonical is rendered in metadata but deliberately excluded from sitemaps;
`none` renders no canonical and is also excluded because there is no canonical
URL to list.

Configure `siteUrl` in `seoPlugin`, normally from an environment variable. It
must be an HTTP(S) origin such as `https://example.com`—not a base path, query,
fragment, or credential-bearing URL. The plugin does not support site base
paths in this release.

### `renderSchemaJsonLd(input)`

Returns the resolved schema object or `null`. When site settings configure an
organization and/or site name it returns an `@graph` containing the document
schema plus Organization and WebSite schema. Organization URL falls back to the
configured `siteUrl`, logo uses `resolveMediaUrl`, and `sameAs` links are emitted.

```ts
const schema = await renderSchemaJsonLd({
  payload,
  collection: 'posts',
  id: postId,
  locale: 'en',
})
```

Raw schema must be a JSON object—arrays, null, and primitives are rejected.
Generated-schema ownership is explicit: the plugin fixes `@context` to
`https://schema.org`, uses the selected supported `seo.schema.type` for
`@type`, and writes the resolved canonical as `url`. Collection mappings and
per-document visual overrides may supply `name` and `image`; upload images are
resolved through `resolveMediaUrl`. `rawJson` is a full replacement and owns
all keys itself. Type-specific generated builders normalize Article authors,
Product offers/brands, FAQ questions and answers, and LocalBusiness addresses.
Use `serializeJsonLd` when embedding the returned object in an HTML script
element.

## Redirects, robots, and sitemaps

### `findSeoRedirect({ payload, sourcePath })`

Returns an enabled exact-path redirect or `null`:

```ts
const redirect = await findSeoRedirect({ payload, sourcePath: '/old-page' })
// { destination: '/new-page', statusCode: 301 } | null
```

`sourcePath` is normalized as an internal path. Query strings, hashes, origins,
and invalid values return `null`. The helper only finds redirects; the
application performs the HTTP redirect.

### `renderRobotsTxt({ payload, locale })`

Returns robots.txt text from the localized SEO Settings Global. Generated
mode validates user agents, paths, and sitemap URLs and rejects CR/LF input;
arbitrary text is permitted only by explicit override mode. Application-provided
sitemap URLs from `robots.resolveSitemapUrls` are emitted in generated mode.

### `renderSitemapXml({ payload, collection, locale, page })`

Returns XML for one sitemap chunk. Entries must be published, not deleted,
have an eligible URL, resolve to indexable effective robots, and not be rejected
by `sitemap.exclude`. External and canonical-`none` pages are excluded. Entries
are deduplicated by their final normalized canonical URL across the complete
locale dataset: the first eligible document in Payload's stable sitemap order
wins a collision and later documents are omitted. The 25,000-entry chunk
boundary and sitemap index therefore use deduplicated eligible URLs, not raw
document counts.

When localization is configured, each eligible entry includes XML-escaped
`xhtml:link` alternates using the exact same translation eligibility resolver as
metadata. Alternates include self, eligible published/indexable translations,
and `x-default` when configured and eligible; missing, fallback-only, draft,
noindex, external-canonical, and canonical-`none` translations are omitted. The
XHTML namespace is emitted only when an entry has alternates. Invalid pages,
disabled collections, invalid site URLs, or top-level resolution failures
produce a valid empty sitemap document rather than throwing.

### `renderSitemapIndexXml({ payload })`

Returns XML containing sitemap chunk URLs for every enabled collection and
configured locale. It calls `resolveChunkUrl` for each non-empty chunk. With
localization disabled, the resolver receives `locale: ''`. Same-site chunk URLs
receive the configured `url.trailingSlash` normalization; external chunk URLs
are preserved after validation.

Neither sitemap helper registers a route or sets an XML response header.

## Next.js adapter

`@krameri/payload-seo/next` exports `resolveNextMetadata(input)`. It projects
resolved values into a structurally compatible Next.js `Metadata` object,
including canonical and language alternates, robots directives, and social
image arrays. Custom robots are emitted as a complete Next robots string so no
supported directive is lost. Noindex, draft, deleted, external-canonical, and
no-canonical translations are excluded from hreflang. See the [Next.js guide](NEXTJS.md) for usage.

## Other exports

The root entry point exports `loadDocumentWithoutFallback`,
`loadSettingsWithoutFallback`, `getByPath`, and `resolveSeoMetadataCore` for
advanced integrations. These are lower-level building blocks; prefer the
public helpers above for normal frontend delivery.
