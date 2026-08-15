---
'@sittari/payload-path-field': patch
---

Keep startup path backfills from rejecting Payload initialization when legacy documents fail current schema validation. Invalid documents are logged and skipped per collection, locale, and draft state while other missing paths continue rebuilding.
