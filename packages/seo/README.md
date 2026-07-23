# @sittari/payload-seo

Locale-safe SEO fields, metadata resolution, robots, exact redirects, and
sitemap helpers for Payload CMS v3. Its Admin UI supports English, Russian,
and Ukrainian. The plugin does not register public routes.

## Install

```bash
pnpm add @sittari/payload-seo
```

## Usage

```ts
import { buildConfig } from "payload";
import { seoPlugin } from "@sittari/payload-seo";

export default buildConfig({
  plugins: [
    seoPlugin({
      siteUrl: "https://example.com",
      collections: {
        pages: { sitemap: { fields: ["slug"] } },
      },
      media: {
        collection: "media",
        resolveMediaUrl: ({ media }) =>
          typeof media.url === "string" ? media.url : null,
      },
      resolveUrl: ({ document }) =>
        typeof document.slug === "string" ? `/${document.slug}` : null,
      resolveChunkUrl: ({ collection, locale, page }) =>
        `https://example.com/sitemaps/${collection}/${locale}/${page}.xml`,
    }),
  ],
  collections: [Pages, Media],
});
```

Schema JSON is editor-managed in the generated SEO Settings Global. Editors can
create ordered global schemas and collection templates, start from a blank
object or one of the six exported `SEO_SCHEMA_STARTERS`, and mark any number of
collection templates as defaults. Documents store stable template references
and localized JSON Patch overrides; templates remain live after documents are
created.

See the full [configuration and helper API](https://github.com/sittari-studio/payload-plugins/blob/main/packages/seo/docs/PUBLIC_API.md) and [integration requirements](https://github.com/sittari-studio/payload-plugins/blob/main/packages/seo/docs/PAYLOAD_INTEGRATION.md).
See [Admin translation requirements](https://github.com/sittari-studio/payload-plugins/blob/main/packages/seo/docs/ADMIN_TRANSLATIONS.md) for the supported interface languages and fallback behavior.
