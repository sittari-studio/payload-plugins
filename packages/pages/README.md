# @sittari/payload-pages

A Payload CMS plugin that adds a versioned `pages` collection with configurable page types, localized fields, drafts, and autosave.

## Install

```bash
pnpm add @sittari/payload-pages
```

## Basic usage

```ts
import { buildConfig } from "payload";
import { pagesPlugin } from "@sittari/payload-pages";

export default buildConfig({
  plugins: [
    pagesPlugin({
      blockSlugs: ["hero", "content"],
    }),
  ],
  collections: [],
});
```

## Configuration

All options are optional.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `blockSlugs` | `string[]` | `[]` | Block slugs available to the default `flexible` page type. |
| `enabled` | `boolean` | `true` | Set to `false` to return the incoming Payload config unchanged. |
| `localizeTitle` | `boolean` | `true` | Enables or disables localization on the default `title` field. |
| `pageTypes` | `({ defaultPageTypes }) => PageTypes` | Default page types | Extends, removes, or replaces the page-type definitions. |
| `slugField` | `({ defaultSlugField }) => RowField` | Default slug field | Extends or replaces the generated slug row. |
| `overrides` | `(defaultCollection) => CollectionConfig` | Default collection | Extends or replaces the final `pages` collection configuration. Applied last. |

The plugin also exports the `PagesPluginConfig`, `PageTypeConfig`, and `PageTypes` TypeScript types from the package root and from `@sittari/payload-pages/types`.

### Enable or disable the plugin

```ts
pagesPlugin({
  enabled: process.env.ENABLE_PAGES !== "false",
});
```

When disabled, the plugin does not add the `pages` collection.

### Configure flexible-page blocks

```ts
pagesPlugin({
  blockSlugs: ["hero", "content", "gallery"],
});
```

These values become `blockReferences` on the `blocks` field of the default `flexible` page type.

### Configure title localization

The default title is localized. Disable localization when the Payload project does not use localized page titles:

```ts
pagesPlugin({
  localizeTitle: false,
});
```

### Extend or replace page types

Spread `defaultPageTypes` to retain the built-in types while adding your own:

```ts
pagesPlugin({
  pageTypes: ({ defaultPageTypes }) => ({
    ...defaultPageTypes,
    blogIndex: {
      label: "Blog Index",
      fields: [
        {
          name: "heading",
          type: "text",
        },
      ],
    },
  }),
});
```

Return a new object without spreading `defaultPageTypes` to replace all built-in page types:

```ts
pagesPlugin({
  pageTypes: () => ({
    landingPage: {
      label: "Landing Page",
      fields: [{ name: "sections", type: "blocks", blocks: [] }],
    },
  }),
});
```

Each page type creates a group field named after its object key. The group is shown when the document's `pageType` value matches that key. The first page type is used as the default selection.

### Override the slug field

The callback receives the complete default row created by `createSlugField()` from `@sittari/payload-slug-field`:

```ts
pagesPlugin({
  slugField: ({ defaultSlugField }) => ({
    ...defaultSlugField,
    admin: {
      ...defaultSlugField.admin,
      position: "sidebar",
    },
  }),
});
```

The default slug row is required, localized, positioned in the sidebar, and generated from `title`. It includes the Pages-specific instruction for the home page. For standalone use or to configure a different instruction, import `createSlugField` from `@sittari/payload-slug-field`.

### Override the collection

`overrides` runs after page types, the slug field, and all default fields have been assembled. Use it for access control, hooks, admin settings, versions, or additional fields:

```ts
pagesPlugin({
  overrides: (defaultCollection) => ({
    ...defaultCollection,
    admin: {
      ...defaultCollection.admin,
      defaultColumns: ["title", "pageType", "_status", "updatedAt"],
    },
    fields: [
      ...defaultCollection.fields,
      {
        name: "internalName",
        type: "text",
      },
    ],
  }),
});
```

The callback must return a complete Payload `CollectionConfig`. Spread `defaultCollection` and nested properties you want to preserve when making partial changes.

## Collection defaults

The generated collection has:

- The slug `pages`
- `title` as the admin display title
- English, Russian, and Ukrainian collection and field labels
- Drafts and versions enabled
- Draft autosave every 500 milliseconds
- A required `title` field, localized by default
- A required, localized `slug` generated from `title`
- A required `pageType` select followed by one conditional group per page type

## Default page types

- `standardContent` contains a localized `content` rich-text field.
- `flexible` contains a `blocks` field whose `blockReferences` come from `blockSlugs`.

Payload localization must be configured in the consuming project when using the default localized fields.
