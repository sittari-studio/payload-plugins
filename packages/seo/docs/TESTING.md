# Testing strategy

The implementation should use the package's Vitest convention and add
Payload-backed integration tests where plugin configuration and persistence
behavior matter. Tests must run through the package test script and the
workspace Turbo test task.

## Unit tests

Unit-test pure functions without a Payload server:

- configuration validation and generated-name collision detection;
- canonical and URL validation;
- dot-path mapping lookup;
- same-locale fallback order;
- title template behavior;
- Open Graph and Twitter/X fallback chains;
- robots directive normalization;
- raw JSON parse, replacement, and reset semantics;
- redirect source normalization and loop detection;
- robots generated, append, and override text;
- XML escaping, sitemap chunking, and lastmod formatting;
- Next.js metadata projection from the normalized result.

Every missing, invalid, empty, or resolver-null branch should assert omission,
not a synthesized value.

## Payload integration tests

Create test configurations with at least two unrelated collections and at least
two locales. Verify:

1. Only configured collections receive one generated SEO group.
2. Existing fields, hooks, and admin configuration remain intact.
3. The settings Global and redirects collection are added once and use their
   configured access/names.
4. Localized SEO fields persist independently in English and Spanish.
5. A Spanish resolver cannot read English title, description, canonical,
   social, schema, or document mappings when Spanish values are absent.
6. Draft documents are available to appropriately authorized admin editing but
   excluded from default metadata and sitemap helpers.
7. Manual canonical, raw JSON, duplicate redirect, invalid destination, and
   loop validation reject writes.
8. Disabled redirects are not returned by lookup and do not participate in
   active redirect chains.
9. Sitemap output includes only published documents, respects locale/page, has
   at most 25,000 source documents per page, and contains no hreflang.
10. Sitemap index uses configured collection/locale inventory and chunk URLs.

Use an adapter appropriate for CI and ensure each test resets persisted state.
Do not rely solely on mocked Local API responses for validation or localization
coverage.

## Admin UI tests

Component tests should verify:

- the SEO section/tab and conditional manual canonical field are rendered;
- each preview reacts to current localized form values;
- image previews handle a missing or unresolved image safely;
- raw JSON errors are clear and associated with the field;
- reset clears only raw JSON and returns the preview to generated schema;
- users without the relevant field access cannot edit restricted fields.

Use browser-level smoke coverage against a real Payload Admin instance before
release to validate import-map registration and client component module paths.

## Contract and regression matrix

Maintain fixtures for these cases:

| Case | Expected result |
| --- | --- |
| SEO title absent, mapped title present | Use mapped title in active locale. |
| Active-locale values absent, other locale populated | Omit or use allowed global default; never use other locale. |
| Auto canonical resolver returns null | Omit canonical. |
| Manual canonical is external HTTPS | Return manual canonical. |
| Canonical mode none | Omit canonical despite resolver result. |
| OG fields absent | Use resolved standard metadata. |
| Twitter fields absent | Use resolved OG metadata. |
| Valid raw schema exists | Return only parsed raw schema. |
| Invalid legacy raw schema exists | Omit schema and log; do not throw. |
| Generated robots plus append | Preserve group order then append text. |
| Robots override | Return only override text. |
| Redirect A to B and B to A | Reject the second enabled redirect. |
| Missing localized URL | Omit canonical, hreflang entry, and sitemap entry. |

## Release gates

Before publishing:

1. Run pnpm typecheck.
2. Run pnpm test.
3. Run pnpm build.
4. Test a production build of a host Payload application with generated types
   and import map.
5. Review public type declarations and package exports.
6. Confirm the normative documentation matches implemented behavior.
