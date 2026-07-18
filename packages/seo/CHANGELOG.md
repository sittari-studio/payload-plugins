# @sittari/payload-seo

## 0.2.1

### Patch Changes

- Fix collapsibles being forced to be 56px

## 0.2.0

### Minor Changes

- Replace developer-defined schema types, mappings, visual fields, breadcrumbs, and organization settings with an editor-managed JSON-LD workflow. This is a breaking schema-storage and configuration change with no legacy reader or migration.

  Editors can now manage ordered global and collection templates, create schemas owned by individual documents, start from six built-in schema types, and customize schema values through localized scalar JSON Patch overrides. Stable template references keep document schemas linked to Settings, support multiple defaults and repeated instances, and clean up deleted references transactionally.

  Add recursive and raw JSON schema editors, field-variable discovery and substitution, schema graph composition, document-owned schema resolution, configurable variable exclusions, and the public schema utility and type exports needed for custom integrations.

## Unreleased

### Breaking Changes

- Replace developer-defined schema types, mappings, visual fields,
  breadcrumbs, and Organization settings with editor-managed global and
  collection JSON templates, stable document references, localized JSON Patch
  overrides, field variables, and graph composition. No migration or legacy
  reader is included.

## 0.1.1

### Patch Changes

- 1450065: Harden sitemap and redirect reads with focused field projections and correct the published setup documentation.
- 404c709: Initial release
