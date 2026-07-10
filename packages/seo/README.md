# @krameri/payload-seo

Locale-safe SEO fields, metadata resolution, robots, exact redirects, and
sitemap helpers for Payload CMS v3. Its Admin UI supports English, Russian,
and Ukrainian. The plugin does not register public routes.

## Install

```bash
pnpm add @krameri/payload-seo
```

## Usage

```ts
import { buildConfig } from 'payload'
import { seoPlugin } from '@krameri/payload-seo'

export default buildConfig({
  plugins: [seoPlugin({
    siteUrl: 'https://example.com',
    collections: {
      pages: { schemaType: 'WebPage', sitemap: { fields: ['slug'] } },
    },
    media: {
      collection: 'media',
      resolveMediaUrl: ({ media }) => typeof media.url === 'string' ? media.url : null,
    },
    resolveUrl: ({ document }) => typeof document.slug === 'string' ? `/${document.slug}` : null,
    resolveChunkUrl: ({ collection, locale, page }) =>
      `https://example.com/sitemaps/${collection}/${locale}/${page}.xml`,
  })],
  collections: [Pages, Media],
})
```

See the full [configuration and helper API](https://github.com/roxxel/krameri-payload-plugins/blob/main/packages/seo/docs/PUBLIC_API.md) and [integration requirements](https://github.com/roxxel/krameri-payload-plugins/blob/main/packages/seo/docs/PAYLOAD_INTEGRATION.md).
See [Admin translation requirements](https://github.com/roxxel/krameri-payload-plugins/blob/main/packages/seo/docs/ADMIN_TRANSLATIONS.md) for the supported interface languages and fallback behavior.
