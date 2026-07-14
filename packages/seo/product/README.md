# @sittari/payload-seo documentation

This directory is the implementation and maintenance specification for
@sittari/payload-seo, a Payload CMS v3 plugin. These documents define and
maintain its v1 behavior.

The plugin stores and manages SEO data in Payload. It does not create public
routes. Application developers own their metadata, schema, redirects,
robots.txt, and sitemap routes and call the exported helpers from those routes.

## Reading order

| Document | Purpose |
| --- | --- |
| [Product requirements](PRODUCT_REQUIREMENTS.md) | Product scope, editor experience, invariants, and acceptance criteria. |
| [Architecture](ARCHITECTURE.md) | Plugin boundaries, module responsibilities, Payload integration rules, and data flow. |
| [Public API](PUBLIC_API.md) | Exports, TypeScript contracts, input/output semantics, and route examples. |
| [Payload integration](PAYLOAD_INTEGRATION.md) | Plugin configuration, generated collection fields, global settings, and redirects collection. |
| [Admin translations](ADMIN_TRANSLATIONS.md) | English, Russian, and Ukrainian translation contract for plugin-owned Admin UI. |
| [Resolution rules](RESOLUTION_RULES.md) | Locale, fallback, canonical, metadata, schema, robots.txt, sitemap, and redirect behavior. |
| [Access and validation](ACCESS_AND_VALIDATION.md) | Authorization boundaries, validation rules, and malformed-data handling. |
| [Testing strategy](TESTING.md) | Unit, integration, admin UI, regression, and acceptance test requirements. |
| [Implementation milestones](IMPLEMENTATION_MILESTONES.md) | Ordered, reviewable implementation plan. |
| [Maintenance](MAINTENANCE.md) | Compatibility, security, release, and operational guidance. |

## Normative language

Must and must not are release-blocking requirements. Should indicates the
expected v1 implementation unless a documented exception is approved.

## V1 invariants

- Payload CMS v3 is the only supported CMS version.
- The public package name is @sittari/payload-seo.
- SEO data lives on the enabled document, not in a separate SEO collection.
- The plugin never registers a public HTTP route.
- A developer-supplied URL resolver is required and is configured once at the
  plugin level.
- All public helpers exclude draft content by default.
- No helper may use cross-locale fallback.
- An invalid, missing, or unresolved input causes dependent output to be omitted,
  never guessed or emitted in malformed form.
- Plugin-owned Admin UI supports English (`en`), Russian (`ru`), and Ukrainian
  (`uk`); its interface language is independent from the document content
  locale.
