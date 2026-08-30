# @sittari/payload-permalink

## 1.0.3

### Patch Changes

- 8fb6067: Update the permalink preview immediately after editing a slug.

## 1.0.2

### Patch Changes

- 10de10d: skip slug generation during autosaves

## 1.0.1

### Patch Changes

- 84bff06: Preserve published documents and routes when rebuilding paths for documents with newer drafts.

## 1.0.0

### Major Changes

- 0ac43d9: Replace resolver-based path generation with WordPress-style collection prefixes, built-in slug generation, locale prefixing, hierarchical permalinks, and an integrated permalink editor. The pages plugin no longer creates or configures slugs; permalink ownership belongs to `@sittari/payload-permalink`.

## 0.4.0

### Minor Changes

- 51813d7: Add an internal route registry for published path lookup and lifecycle synchronization. Simplify `findDocumentByPath` to accept only `path` and `overrideAccess`.

## 0.3.1

### Patch Changes

- b6e39b7: Keep startup path backfills from rejecting Payload initialization when legacy documents fail current schema validation. Invalid documents are logged and skipped per collection, locale, and draft state while other missing paths continue rebuilding.

## 0.3.0

### Minor Changes

- fix(path-field): allow unresolved paths in drafts and autosaves

## 0.2.1

### Patch Changes

- test

## 0.2.0

### Minor Changes

- I forgot

## 0.1.1

### Patch Changes

- Init
