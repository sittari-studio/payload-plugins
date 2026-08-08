---
"@sittari/payload-pages": major
---

Replace implicit default page types and the page-types callback with explicit composition. Export `createStandardContentPageType` and `createFlexiblePageType`, require a page-types object when the plugin is enabled, and move `blockSlugs` to the flexible page-type factory.
