# @sittari/payload-link-field

PayloadCMS link-field plugin.

## Install

```bash
pnpm add @sittari/payload-link-field
```

## Usage

Import the admin stylesheet from your Payload admin CSS file:

```css
@import "@sittari/payload-link-field/admin.css";
```

```ts
import { buildConfig } from "payload";
import { linkField, linkFieldPlugin } from "@sittari/payload-link-field";

export default buildConfig({
  plugins: [
    linkFieldPlugin({
      resolveDocumentUrl: ({ collectionSlug, document }) => {
        if (collectionSlug === "pages" && typeof document?.slug === "string") {
          return `/${document.slug}`;
        }

        return null;
      },
    }),
  ],
  collections: [
    {
      slug: "pages",
      fields: [
        {
          name: "title",
          type: "text",
        },
        linkField({
          name: "link",
          label: "Link",
          appearance: "drawer",
          relationTo: ["pages", "posts"],
        }),
      ],
    },
  ],
});
```

## Lexical links

`LinkFieldFeature()` uses the same field schema and value shape as `linkField()`. It must
replace Payload's native feature (both features use the `link` key), and
`linkFieldPlugin()` remains required because it registers `resolveDocumentUrl` for reads
and serialization.

```ts
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { LinkFieldFeature } from '@sittari/payload-link-field'

const editor = lexicalEditor({
  features: ({ defaultFeatures }) => [
    ...defaultFeatures.filter((feature) => feature.key !== 'link'),
    LinkFieldFeature({
      relationTo: ['pages', 'posts'],
    }),
  ],
})
```

The feature accepts `defaultType`, `relationTo`, `showLabel`, and `showNewTab`.
When `relationTo` is omitted, all collections are considered and collections the
current admin user cannot read are removed from the relationship selector.
Existing Payload-native custom and internal link nodes are normalized lazily when read or
opened in the editor; their next save writes only the plugin-owned field shape.
