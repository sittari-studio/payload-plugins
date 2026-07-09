# Product requirements

## Product summary

@krameri/payload-seo is a reusable SEO plugin for Payload CMS v3. Developers
enable it on arbitrary collections and configure collection-specific URL and
schema behavior. Editors then manage localized SEO data in Payload Admin.

The product provides:

- document SEO fields and previews;
- an Admin interface translated into English, Russian, and Ukrainian;
- site-wide SEO and robots.txt settings;
- exact-path redirects;
- framework-neutral and Next.js metadata helpers;
- schema JSON-LD helpers;
- robots.txt and sitemap XML helpers.

It deliberately does not create the application routes that serve those
outputs.

## Goals

- Reduce repeated SEO-field configuration across Payload projects.
- Provide a coherent editor interface for metadata, social cards, canonical
  behavior, robots directives, focus keywords, and schema markup.
- Make localization safe by never falling back from one locale to another.
- Provide a complete, consistent plugin-owned Admin UI in English, Russian,
  and Ukrainian without changing persisted SEO values.
- Let frontends consume the same rules through framework-neutral helpers and
  Next.js App Router adapters.
- Store, validate, and resolve SEO data without providing SEO scoring or
  recommendations.

## Out of scope for v1

- SEO, readability, or keyword-density scoring.
- AI generation, analytics, Search Console, backlinks, or recommendations.
- Wildcard and regular-expression redirects.
- Automatic public routes, multi-tenancy, and a required example application.
- Schema.org semantic validation beyond JSON syntax validation.
- External URL fields for document Open Graph or Twitter images.
- Hreflang entries in sitemap XML.

## User responsibilities

| User | Responsibilities |
| --- | --- |
| Application developer | Enables collections; supplies URL, schema, sitemap-chunk, and optional robots sitemap resolvers; configures access; creates public routes. |
| Editor | Maintains localized SEO data, global settings, robots content, and redirects within granted access. |
| Plugin | Adds fields and admin UI, validates data, resolves output consistently, and exposes helpers. |

## Editor experience

Every enabled collection document has one dedicated SEO tab or section. It
contains title and description, focus keyword, canonical controls, robots
controls, Open Graph, Twitter/X, schema markup, and preview components.

The UI must show:

- a Google-result preview;
- an Open Graph preview;
- a Twitter/X-card preview;
- schema-type-specific visual inputs;
- a raw JSON override editor and an action that clears that override;
- clear field-level validation messages, especially for canonical URLs and raw
  JSON.

Previews use the current edit-state and selected locale. They are informational:
they do not create a public route and do not bypass access controls.

All plugin-owned Admin labels, option labels, validation messages, preview
copy, schema-editor copy, buttons, and accessibility labels must be available
in English (`en`), Russian (`ru`), and Ukrainian (`uk`). The active Payload
Admin interface language controls those strings; it is independent from the
selected document content locale. English is the complete fallback for
unsupported interface language codes; supported regional codes resolve to their
base language. See
[Admin translations](ADMIN_TRANSLATIONS.md) for the implementation contract.

## Acceptance criteria

V1 is complete when all of the following are true:

1. A developer can enable SEO on any configured Payload v3 collection without
   the plugin assuming a collection name or a field such as title or slug.
2. Enabled documents receive localized SEO fields stored on the document.
3. Editors can manage all SEO, canonical, robots, social, and schema values
   described in the PRD.
4. Schema type and document-to-schema mappings are configurable per collection;
   a document can override the type or replace the generated schema with valid
   raw JSON.
5. The plugin supplies an access-controlled global and redirects collection,
   and helper functions for robots.txt and exact redirects.
6. Sitemap helpers render collection/locale/page XML with no more than 25,000
   entries per page and omit unpublished documents.
7. Framework-neutral and Next.js metadata helpers omit unpublished documents by
   default, respect locale isolation, and can render schema JSON-LD.
8. Invalid canonical URLs, raw JSON, redirect sources/destinations, loops, and
   unresolved URLs do not lead to invalid persisted or public output.
9. No plugin configuration adds a public route.
10. In an Admin session using English, Russian, or Ukrainian, every
    plugin-owned UI string is rendered in that language while stored values and
    SEO output remain identical for equivalent input.
