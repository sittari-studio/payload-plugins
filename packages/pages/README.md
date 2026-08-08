# @sittari/payload-pages

A Payload CMS plugin that adds a versioned `pages` collection with configurable page types, localized fields, drafts, and autosave.

## Install

```bash
pnpm add @sittari/payload-pages
```

## Basic usage

```ts
import { buildConfig } from "payload";
import {
  createFlexiblePageType,
  createStandardContentPageType,
  pagesPlugin,
} from "@sittari/payload-pages";

export default buildConfig({
  plugins: [
    pagesPlugin({
      pageTypes: {
        standardContent: createStandardContentPageType(),
        flexible: createFlexiblePageType({
          blockSlugs: ["hero", "content"],
        }),
      },
    }),
  ],
  collections: [],
});
```

## Configuration

`pageTypes` is required unless the plugin is disabled.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `enabled` | `boolean` | `true` | Set to `false` to return the incoming Payload config unchanged. |
| `localizeTitle` | `boolean` | `true` | Enables or disables localization on the default `title` field. |
| `pageTypes` | `PageTypes` | Required | Page-type definitions keyed by the value stored in `pageType`. |
| `slugField` | `({ defaultSlugField }) => RowField` | Default slug field | Extends or replaces the generated slug row. |
| `overrides` | `(defaultCollection) => CollectionConfig` | Default collection | Extends or replaces the final `pages` collection configuration. Applied last. |

The package root exports `createStandardContentPageType` and `createFlexiblePageType`. Their option types and the `PagesPluginConfig`, `PageTypeConfig`, and `PageTypes` types are also available from the package root and from `@sittari/payload-pages/types`.

### Enable or disable the plugin

```ts
pagesPlugin({
  enabled: false,
});
```

When disabled, the plugin does not add the `pages` collection.

### Compose page types

```ts
pagesPlugin({
  pageTypes: {
    standardContent: createStandardContentPageType(),
    flexible: createFlexiblePageType({
      blockSlugs: ["hero", "content", "gallery"],
    }),
    blogIndex: {
      label: "Blog Index",
      fields: [{ name: "heading", type: "text" }],
    },
  },
});
```

The object key becomes the stored value and group-field name. Its `label` is used in the page-type selector. The first entry is the default selection.

The built-in factories are optional. Include either, both, or neither of them.

### Configure title localization

The default title is localized. Disable localization when the Payload project does not use localized page titles:

```ts
pagesPlugin({
  pageTypes: {
    standardContent: createStandardContentPageType(),
  },
  localizeTitle: false,
});
```

### Customize a built-in page type

Factory options shallowly replace the generated page-type properties. This keeps array replacement explicit and avoids deep-merge behavior:

```ts
pagesPlugin({
  pageTypes: {
    standardContent: createStandardContentPageType({
      label: "Article",
      fields: [
        {
          name: "content",
          type: "richText",
          localized: false,
          editor: customEditor,
        },
      ],
    }),
  },
});
```

The flexible factory accepts `blockSlugs`, which become `blockReferences` on its `blocks` field:

```ts
createFlexiblePageType({
  blockSlugs: ["hero", "content", "gallery"],
});
```

### Override the slug field

The callback receives the complete default row created by `createSlugField()` from `@sittari/payload-slug-field`:

```ts
pagesPlugin({
  pageTypes: {
    standardContent: createStandardContentPageType(),
  },
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
  pageTypes: {
    standardContent: createStandardContentPageType(),
  },
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

## Built-in page-type factories

- `createStandardContentPageType()` creates a localized `content` rich-text field.
- `createFlexiblePageType()` creates a `blocks` field and accepts a `blockSlugs` option.

The plugin does not add these types automatically. Payload localization must be configured in the consuming project when using the standard-content factory's localized field.
