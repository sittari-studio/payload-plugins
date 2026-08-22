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
          localizeLabel: true,
        }),
      ],
    },
  ],
});
```

`localizeLabel` controls whether the link's nested `label` field is localized.
It defaults to `true`; set it to `false` when link labels should use one value
across all locales.

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
When `relationTo` is omitted, all non-internal collections are considered and
collections the current admin user cannot read are removed from the relationship
selector. Collections whose slugs start with `payload-` are always discarded,
including when explicitly provided.
Existing Payload-native custom and internal link nodes are normalized lazily when read or
opened in the editor; their next save writes only the plugin-owned field shape.

## Frontend rendering

The React export provides JSX converters for Payload's `RichText` component and is safe to
import from React Server Components. Spread the plugin converters after Payload's defaults:

```tsx
import { RichText } from '@payloadcms/richtext-lexical/react'
import { LinkFieldJSXConverter } from '@sittari/payload-link-field/react'

export const Content = ({ data }) => (
  <RichText
    converters={({ defaultConverters }) => ({
      ...defaultConverters,
      ...LinkFieldJSXConverter(),
    })}
    data={data}
  />
)
```

The spread order intentionally replaces Payload's default `link` and `autolink` converters.
The converter renders only a populated `fields.url`; unresolved links preserve their
formatted children without rendering an anchor or falling back to `customUrl`.

Pass a `renderer` to integrate Next.js `Link`, analytics, or custom routing. The renderer
receives normalized `fields`, rendered `children`, `url`, `newTab`, and the untouched
serialized `node`:

```tsx
import Link from 'next/link'
import { LinkFieldJSXConverter } from '@sittari/payload-link-field/react'

const converters = LinkFieldJSXConverter({
  renderer: ({ children, newTab, url }) => (
    <Link
      href={url}
      rel={newTab ? 'noopener noreferrer' : undefined}
      target={newTab ? '_blank' : undefined}
    >
      {children}
    </Link>
  ),
})
```
