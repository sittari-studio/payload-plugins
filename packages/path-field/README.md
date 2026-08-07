# @sittari/payload-path-field

Adds a localized, stored canonical `path` field to selected Payload collections
and provides server-side lookup, pagination, and rebuilding helpers.

```ts
import { pathFieldPlugin } from '@sittari/payload-path-field'

pathFieldPlugin({
  collections: {
    pages: true,
    categories: { parentField: 'parent' },
  },
  resolveDocumentUrl: ({ doc }) => `/${String(doc.slug)}`,
})
```

When `parentField` is used, the plugin which creates that relationship (such as
`@payloadcms/plugin-nested-docs`) must be listed before `pathFieldPlugin`.

Create bound helpers in server-only code:

```ts
import { createPathHelpers } from '@sittari/payload-path-field'
import { getPayload } from 'payload'
import config from '@payload-config'

export const paths = createPathHelpers({
  getPayload: () => getPayload({ config }),
})
```

Document lookup enforces access control, excludes drafts, disables locale
fallback, and requires an explicit locale when Payload localization is enabled.
Pass `pagination: true` to resolve terminal `/page/:page` routes without storing
those derived paths.
