# Resolution and output behavior

## Locale isolation

Every locale-aware operation uses the active locale with Payload fallbackLocale
set to false. This includes reading documents, document field mappings, SEO
fields, localized Global values, URL resolution, canonical values, social
metadata, schema input, and sitemap documents. Site URL remains one
non-localized Global value.

The only permitted fallback order is within the same locale:

1. localized document SEO value;
2. localized configured document-field mapping;
3. an applicable localized Global default;
4. omit the value.

Do not substitute a different locale at any point. A resolver returning null,
an empty string, an invalid URL, or an unavailable upload relation is treated
as missing.

## Canonical URLs

| Mode | Behavior |
| --- | --- |
| auto | Resolve the document path for the active locale and combine it with a valid site URL. |
| manual | Use the localized manual URL only if it is a valid absolute HTTP/HTTPS URL. External URLs are allowed. |
| none | Omit the canonical tag. |

Auto is the default. A relative resolver result must be a valid site-relative
path; a missing or invalid site URL/path makes canonical output absent. The
plugin must not concatenate strings in a way that can produce malformed URLs.

## Standard and social metadata

Title and description follow the locale fallback order above. Apply the global
title template only to a resolved title. A title template must contain exactly
one percent-s placeholder, which is replaced by that title. A title template
never creates a title by itself.

| Output | Fallback order |
| --- | --- |
| Open Graph title | Explicit localized OG title, then resolved standard title. |
| Open Graph description | Explicit localized OG description, then resolved standard description. |
| Open Graph image | Explicit localized OG upload, then valid global default OG upload. |
| Twitter/X title | Explicit localized Twitter title, then resolved Open Graph title. |
| Twitter/X description | Explicit localized Twitter description, then resolved Open Graph description. |
| Twitter/X image | Explicit localized Twitter upload, then resolved Open Graph image. |
| Twitter/X card | Explicit localized card type, then global default card type. |

The helper returns only an image URL returned by the configured resolveMediaUrl
function. An unresolved relationship or a null resolver result must be omitted.

Robots output uses localized document directives first, then the localized
Global default, then omission. Index/noindex and follow/nofollow are
represented independently so the metadata adapter can form a complete robots
directive only from valid values.

## Hreflang

Hreflang is metadata-helper output only. For each configured Payload locale,
load the document in that locale with no fallback and call the URL resolver. Add
an alternate only when the locale-specific document and its path are valid.
Include the active locale when valid. Do not add x-default. Never put hreflang
entries in sitemap XML.

## Schema generation

Each collection has a configured default schema type. A valid document
seo.schema.type replaces that default. Generated schema starts from the selected
schema type, organization defaults where relevant, and configured manual
mappings into the localized document and schema visual values.

If seo.schema.rawJson contains valid JSON, parse it and return that parsed value
as the entire schema. Do not merge it with generated fields. If it is absent,
generate the configured schema. JSON syntax validation happens at write time;
the resolver should still defensively omit malformed persisted legacy data.

The v1 plugin validates JSON syntax only. It does not claim that generated or
overridden data satisfies schema.org's semantic requirements.

The schema reset action clears rawJson for the active locale and leaves type and
visual values intact. After save, the next resolver call returns generated
schema.

## Robots.txt rendering

renderRobotsTxt reads the Global settings and developer-provided sitemap URLs.

| Global mode | Output |
| --- | --- |
| generated | Serialize each user-agent group, then append configured Sitemap lines, then append non-empty appendText. |
| override | Return overrideText exactly as stored; do not include generated rules, sitemap lines, or appendText. |

Generated groups preserve editor order. Each group emits User-agent first,
followed by its Allow and Disallow paths in stored order. Separate groups and
appended sections with one blank line. Omit empty directives. If no valid
generated data exists, return an empty string rather than a fabricated default.

The helper returns text only. The application creates the public /robots.txt
route and decides cache headers.

## Redirect lookup

findSeoRedirect accepts a source path, applies the required source
normalization, and reads only enabled records. It returns the stored internal
path or valid external URL and status code. It does not resolve chains, alter
the path, or issue an HTTP redirect; the host middleware/route chooses how to
respond.

## Sitemap XML

renderSitemapXml requires collection, locale, and one-based page. It:

1. queries only the configured collection's published documents for that locale
   with no fallback;
2. chunks source documents at 25,000 per page;
3. resolves each document URL and omits entries whose URL is invalid;
4. emits loc and, when reliable, lastmod;
5. XML-escapes all values and emits valid sitemap urlset XML;
6. emits no hreflang alternates.

updatedAt is the default reliable last-modified value. A collection
last-modified resolver may replace it; invalid dates omit lastmod. Source
pagination, rather than output-entry count, defines page boundaries, so a page
can have fewer than 25,000 output entries when some documents have no valid
URL.

When sitemap.fields is configured, the document query projects only those
listed paths and updatedAt. Integrators must include every path their URL and
last-modified resolvers read. Omitting sitemap.fields preserves access to the
full document for existing resolvers.

renderSitemapIndexXml accepts the Payload instance but no collection, locale,
or page arguments from the route handler. It derives all enabled sitemap
collections and configured locales from plugin configuration, calculates
published-document page counts, calls the top-level resolveChunkUrl for each
non-empty page, and returns sitemapindex XML. sitemap.enabled defaults to true
for configured collections. Collections and locales without a published source
document are excluded. Invalid chunk URLs are omitted and logged.

Redirect source normalization trims surrounding whitespace, requires a leading
slash, rejects origins, fragments, and query strings, and preserves the
remaining pathname exactly. It does not decode percent encoding, collapse
slashes, strip trailing slashes, or fold case.
