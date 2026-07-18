# Payload integration

The plugin adds an SEO tab to enabled collections, an access-controlled SEO
Settings Global, and the redirects collection. Existing fields, hooks, access,
and endpoints are preserved.

## Settings data

- `globalSchemas` is an ordered list of live templates emitted for every
  enabled document.
- `collectionSchemas` groups ordered templates by collection.
- Each template has a stable `templateId`, name, shared root-object `schema`,
  localized scalar `valueOverrides`, and `isDefault` flag.
- Any number of templates can be default. All current defaults are referenced
  when a document is created unless `schemaInstances` is explicitly supplied.
  An explicit empty array means the editor chose no schemas; later default
  changes do not rewrite documents.
- Template IDs are unique across global and collection templates.
- Deleting a collection template cascades through enabled documents and removes
  every matching schema instance. Deleting a global schema similarly removes
  its document overrides. The cleanup and Settings update share the Payload
  transaction.

## Document data

- `seo.schemaInstances` stores ordered stable template references. Repeating a
  template is valid. Each row carries localized, replace-only scalar JSON Patch
  overrides.
- `seo.globalSchemaOverrides` stores localized patches keyed by global schema
  ID. Global references are implicit and cannot be removed from a document.
- Template choice and JSON shape are shared across locales. A patch must target
  an existing scalar and preserve its JSON type; only replacement values are
  localized.

Payload Admin renders the hidden storage arrays through `SettingsSchemaManager`
and `DocumentSchemaManager`. Both use the shared full-height drawer, recursive
object/array/scalar editor, isolated raw JSON apply flow, and field-variable
suggestions. Generated SEO fields, UI fields, blocks and block descendants,
plus configured prefixes are excluded from suggestions. Starter choice is an
editor action and is never persisted.
