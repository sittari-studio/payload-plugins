# Public API product contract

The current public contract is documented in [the package API](../docs/PUBLIC_API.md).
Schema configuration is editor-managed and is intentionally absent from
`SeoPluginConfig`. This release has no migration or legacy reader.

Public metadata and JSON-LD output shapes remain compatible: a single schema is
an object with one plugin-owned `@context`, while multiple schemas use `@graph`.
