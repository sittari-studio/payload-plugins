# Payload plugin configuration and generated data

## Configuration model

The plugin runs inside Payload buildConfig plugins. It augments only collections
listed in its collections configuration. The selected slug must match an
existing collection. No convention such as pages, posts, title, slug, or media
collection is assumed.

The default generated names are:

| Generated item | Default |
| --- | --- |
| SEO group field | seo |
| Settings Global slug | seo-settings |
| Redirects collection slug | seo-redirects |
| Generated marker | @krameri/payload-seo |

Changing generated names is a configuration migration, not an automatic data
migration.

## Generated document SEO group

All fields below are stored under the generated seo group and are localized.
When Payload localization is disabled, they behave as ordinary non-localized
fields. The group itself should be presented as a dedicated SEO tab or section.

| Path | Payload shape | Purpose |
| --- | --- | --- |
| seo.title | text | Title tag before the title template is applied. |
| seo.description | textarea | Meta description. |
| seo.focusKeyword | text | Editor-only focus keyword; no scoring in v1. |
| seo.canonical.mode | select | auto, manual, or none; defaults to auto. |
| seo.canonical.url | text | Manual absolute canonical URL; only visible in manual mode. |
| seo.robots.index | select | index or noindex. |
| seo.robots.follow | select | follow or nofollow. |
| seo.openGraph.title | text | Open Graph title override. |
| seo.openGraph.description | textarea | Open Graph description override. |
| seo.openGraph.image | upload | Image relation to the plugin-configured or collection-overridden upload collection. |
| seo.twitter.title | text | Twitter/X title override. |
| seo.twitter.description | textarea | Twitter/X description override. |
| seo.twitter.image | upload | Twitter/X image relation. |
| seo.twitter.card | select | Card type override. |
| seo.schema.type | select | Default collection type or document override. |
| seo.schema.values | group | Schema-type-specific visual editor values. |
| seo.schema.rawJson | textarea or code | Complete raw JSON schema override. |

Image fields must be Payload upload relationships. They must not accept external
image URLs in v1. Plugin configuration must provide one upload collection and
a resolveMediaUrl function; a collection may override its upload collection.
The plugin must fail configuration rather than create an unusable upload field.

The schema values group is populated from the collection schema mappings and
schema-type-specific visual definitions. It is not a generic free-form
key-value store. V1 ships visual definitions for WebPage, Article, Product,
Organization, LocalBusiness, and FAQPage. A collection may add visualFields
using only text, textarea, number, checkbox, select, date, and upload Payload
fields, plus mappings from each visual field name to a schema property path.
The raw JSON field stays visible for an explicit full override and its reset
action clears only rawJson.

## Global SEO settings

The plugin adds one access-controlled Global with these groups:

| Setting | Purpose |
| --- | --- |
| siteName | Site-wide name for metadata and schema. |
| siteUrl | Absolute public origin used to build canonical and sitemap URLs. |
| titleTemplate | Title template applied only after a title is resolved. |
| defaultDescription | Fallback meta description. |
| defaultOpenGraphImage | Fallback Open Graph upload relation. |
| defaultTwitterCard | Fallback Twitter/X card type. |
| defaultRobots | Default index and follow directives. |
| organizationSchema | Defaults used when generating organization schema. |
| robots | Generated rules, optional append text, and optional full override. |

Site URL must be a valid absolute HTTP or HTTPS URL and is never localized.
When Payload localization is enabled, siteName, titleTemplate,
defaultDescription, defaultOpenGraphImage, defaultTwitterCard, defaultRobots,
organizationSchema, and all robots settings are localized.

Robots settings contain:

| Field | Semantics |
| --- | --- |
| mode | generated or override. |
| groups | Generated user-agent groups with zero or more allow and disallow paths. |
| appendText | Optional editor text appended only to generated output. |
| overrideText | Complete robots.txt content used only in override mode. |

Developer-configured sitemap URLs are supplied to the renderer; they are not
editable free-form URLs unless a future product decision permits it.

## Redirects collection

The plugin adds an access-controlled redirects collection with timestamps and
these fields:

| Field | Requirement |
| --- | --- |
| source | Exact internal source path, unique after required normalization. |
| destinationType | internal or external. |
| destination | Internal path or full external HTTP/HTTPS URL. |
| statusCode | 301 or 302. |
| enabled | Boolean, defaults to true. |
| notes | Optional editor note, not public output. |

The collection admin view should show source, destination, statusCode, enabled,
and updatedAt. Source must have a database index enforcing uniqueness. The
collection does not require a draft lifecycle because enabled state is the
publication control.

Redirect loop validation checks the complete enabled internal redirect graph:
the candidate may not point to itself directly or eventually reach its own
source through any existing enabled internal redirect. External destinations
terminate a chain. Normalization trims surrounding whitespace, requires a
leading slash, rejects an origin, fragment, or query string, and otherwise
preserves the exact pathname, including trailing slash, percent encoding,
duplicate slashes, and case.

## Admin components

The generated SEO group uses package client components for previews and the
schema reset action. Component configuration may receive only non-sensitive
data: selected locale, labels, field paths, API base path, and marker/version.
It must not embed server secrets, access functions, or unrestricted document
data in admin custom metadata.
