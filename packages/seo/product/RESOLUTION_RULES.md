# Schema resolution rules

Resolution is deterministic:

1. Read the current live template.
2. Apply the active locale's template scalar-value patch.
3. Apply the active locale's document patch.
4. Resolve `$field.path` variables recursively. `$canonicalUrl` resolves to the
   document's canonical URL when available.

An exact variable preserves its native JSON type. Interpolation stringifies
primitives and JSON-serializes objects/arrays. `$$` emits a literal dollar.
Missing variables omit their containing property or array item; explicit null
is retained. Existing explicit `url` values are never overwritten. Invalid or
missing schema instances are diagnosed and omitted independently, without
dropping other valid schemas.

The plugin rejects `@context` in templates and patches. It emits exactly one
top-level `https://schema.org` context and uses `@graph` when more than one
schema resolves.
