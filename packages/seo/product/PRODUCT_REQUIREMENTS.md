# Product requirements

Editors manage reusable JSON schema templates in SEO Settings. Global schemas
are ordered live references for every enabled document. Collection templates
are ordered, reusable, may have multiple defaults, and may be instantiated more
than once per document. Documents and templates keep shared structure across
locales and store localized RFC 6902-style value patches.
Document patches are replace-only, target existing scalar paths, and preserve
the original JSON scalar type so structure cannot diverge between locales.

The Admin schema builder must keep recursive visual and raw JSON views in sync,
offer Payload-styled add/duplicate/reorder/delete controls, and show positioned,
keyboard-operable `$` suggestions. English, Russian, and Ukrainian UI copy is
required.

Runtime behavior, validation, resolution ordering, graph composition, deletion
protection, and locale isolation follow the linked architecture and integration
documents. Schema.org semantic validation and expression functions are out of
scope. This is a breaking release with no migration or compatibility layer.
