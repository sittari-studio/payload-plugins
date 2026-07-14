# @sittari/payload-pages

A small for-internal-use Payload CMS plugin that adds a `pages` collection with configurable page types.

## Install

```bash
pnpm add @sittari/payload-pages
```

## Usage

```ts
import { buildConfig } from "payload";
import { pagesPlugin } from "@sittari/payload-pages";

export default buildConfig({
  plugins: [
    pagesPlugin({
      blockSlugs: ["hero", "content"],

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

      slugField: ({ defaultSlugField }) => ({
        ...defaultSlugField,
        admin: {
          position: "sidebar",
        },
      }),

      overrides: (defaultCollection) => ({
        ...defaultCollection,
        fields: [
          ...defaultCollection.fields,
          {
            name: "internalName",
            type: "text",
          },
        ],
      }),
    }),
  ],
  collections: [],
});
```

## Default page types

- `standardContent` with a `content` rich text field
- `flexible` with a `blocks` field using the configured `blockSlugs` as block references

Page-type fields are stored inside a group named after the page type and are shown conditionally based on the `pageType` field.
