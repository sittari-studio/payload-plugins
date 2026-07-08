# @krameri/payload-link-field

PayloadCMS link-field plugin.

## Install

```bash
pnpm add @krameri/payload-link-field
```

## Usage

Import the admin stylesheet from your Payload admin CSS file:

```css
@import "@krameri/payload-link-field/admin.css";
```

```ts
import { buildConfig } from "payload";
import { linkField, linkFieldPlugin } from "@krameri/payload-link-field";

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
