# Implementation milestones

The v1 product decisions are incorporated into the normative documentation.
Implement each milestone against those contracts and update them before making
an approved behavior change.

## 1. Contract and configuration foundation

- Define all public types and root/types entry-point exports.
- Implement plugin configuration validation.
- Add generated-name collision checks and idempotent generated markers.
- Add focused tests for disabled mode and invalid configuration.

Exit criteria: plugin configuration is typed, validated, and can safely select
collections without writing SEO behavior yet.

## 2. Payload models and validation

- Implement SEO field factory and document admin section.
- Implement settings Global and redirects collection.
- Add field validators, unique index, redirect loop validation, and access
  composition.
- Register client component paths without yet requiring full previews.

Exit criteria: editors can persist valid SEO/global/redirect data; invalid
states cannot be saved.

## 3. Locale-safe resolver core

- Implement no-fallback document and settings loading.
- Implement document-field mappings, canonical logic, metadata fallback,
  robots directives, and schema generation.
- Define normalized result types and omission behavior.

Exit criteria: a pure integration-tested resolver produces the same result for
all consumers and cannot leak another locale.

## 4. Frontend helpers

- Add framework-neutral metadata, schema, redirect, and robots helpers.
- Add sitemap XML and index XML helpers with chunking and escaping.
- Add the Next.js metadata adapter without a root Next.js runtime dependency.

Exit criteria: host route handlers can implement all public SEO endpoints
without duplicating SEO rules.

## 5. Admin experience

- Implement Google, Open Graph, and Twitter/X previews.
- Implement schema visual-editor controls and raw JSON reset action.
- Verify conditional fields, validation messaging, and field access behavior.

Exit criteria: the Payload Admin experience covers every editor requirement in
the PRD.

## 6. Hardening and release

- Complete the test matrix and browser smoke test.
- Profile sitemap and redirect queries; add required indexes/selects.
- Verify build declarations, ESM exports, package files, README links, and
  changeset.
- Confirm these docs and the final public API decisions match implementation.

Exit criteria: all acceptance criteria and release gates pass.
