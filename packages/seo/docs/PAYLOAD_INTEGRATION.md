# Payload integration

## Install

Install the package in a Payload CMS v3 application with React 19:

```bash
pnpm add @krameri/payload-seo
```

The configured plugin collections and media collection must already be present
in `buildConfig`. The plugin validates this at startup and fails early for a
missing collection, invalid option, or generated-name collision.

## Configure the plugin

Add `seoPlugin()` to `plugins` in `payload.config.ts`. This example enables SEO
for `pages` and `posts`, uses a Payload `media` upload collection, and supports
localized URLs.

```ts
import { buildConfig } from 'payload'
import { seoPlugin } from '@krameri/payload-seo'

import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { Posts } from './collections/Posts'

export default buildConfig({
  collections: [Pages, Posts, Media],
  plugins: [
    seoPlugin({
      collections: {
        pages: {
          schemaType: 'WebPage',
          fields: {
            title: 'title',
            description: 'excerpt',
          },
          schema: {
            headline: 'title',
            description: 'excerpt',
          },
          sitemap: {
            fields: ['slug'],
          },
        },
        posts: {
          schemaType: 'Article',
          fields: {
            title: 'title',
            description: 'excerpt',
          },
          schema: {
            headline: 'title',
            datePublished: 'publishedAt',
          },
          sitemap: {
            fields: ['slug', 'publishedAt'],
          },
          lastModified: ({ document }) =>
            typeof document.updatedAt === 'string' ? document.updatedAt : null,
        },
      },
      media: {
        collection: 'media',
        resolveMediaUrl: ({ media }) =>
          typeof media.url === 'string' ? media.url : null,
      },
      resolveUrl: ({ collection, document, locale }) => {
        const slug = typeof document.slug === 'string' ? document.slug : null
        if (!slug) return null

        const prefix = locale === 'en' ? '' : `/${locale}`
        return collection === 'posts'
          ? `${prefix}/blog/${slug}`
          : `${prefix}/${slug}`
      },
      resolveChunkUrl: ({ collection, locale, page }) =>
        `https://www.example.com/sitemaps/${collection}/${locale || 'default'}/${page}`,
      robots: {
        resolveSitemapUrls: ({ locale }) => [
          `https://www.example.com/sitemap-index/${locale || 'default'}`,
        ],
      },
      access: {
        settings: {
          read: ({ req }) => Boolean(req.user),
          update: ({ req }) => Boolean(req.user),
        },
        redirects: {
          admin: ({ req }) => Boolean(req.user),
          create: ({ req }) => Boolean(req.user),
          read: ({ req }) => Boolean(req.user),
          update: ({ req }) => Boolean(req.user),
          delete: ({ req }) => Boolean(req.user),
        },
      },
    }),
  ],
})
```

Replace the simple authenticated-user access functions with your own role-aware
Payload access policies before production.

## Required resolver behavior

`resolveUrl` returns a path for one document in one locale. Return `null` when
the document has no public URL. A valid path starts with one slash, does not
start with `//`, and contains no query string or fragment. The plugin combines
it with the `siteUrl` saved in SEO Settings.

`resolveMediaUrl` receives a populated upload document and must return an
absolute public HTTP(S) URL or `null`. When passing a document directly to a
metadata helper, make sure its SEO image relationships are populated; an ID by
itself cannot be converted into a public URL.

`resolveChunkUrl` returns the absolute URL for a generated sitemap chunk. When
Payload localization is disabled, the sitemap index calls it with `locale: ''`.
Choose a stable URL for that case, as in the example above.

If a collection defines `sitemap.fields`, list every document path used by
`resolveUrl` and `lastModified`. Sitemap reads are projected to those paths and
`updatedAt`, which avoids loading whole documents for large sites.

## What the plugin adds

For each enabled collection, the plugin adds a localized **SEO** tab containing
fields for title, description, canonical URL, robots directives, Open Graph,
X/Twitter, JSON-LD schema, and editor previews.

If the collection already has a top-level Payload `tabs` field, **SEO** is
appended to that tab set. Otherwise, the plugin creates top-level **Content**
and **SEO** tabs, placing the collection's current fields in **Content**. The
generated field marker makes repeated plugin application idempotent.

It also creates these Payload entities:

| Entity | Default slug | Notes |
| --- | --- | --- |
| SEO Settings Global | `seo-settings` | Site URL, metadata defaults, organization schema, and robots settings. |
| Redirects collection | `seo-redirects` | Enabled exact-path 301/302 redirects, with loop validation. |

Set a valid absolute HTTP(S) `siteUrl` in **SEO Settings** before expecting
canonical URLs or sitemap entries. The site URL is not localized; most editor
defaults and document SEO fields are localized when Payload localization is
enabled.

The Settings Global and redirects collection are closed by default. The SEO
group on each enabled document inherits normal field access unless you set the
collection's additive `access.read` or `access.update` option.

## Custom names and disabled mode

Use `names` only when the defaults collide with existing content:

```ts
seoPlugin({
  // ...required options
  names: {
    seoField: 'searchEngine',
    settingsGlobal: 'search-settings',
    redirectsCollection: 'search-redirects',
  },
})
```

Names become stored field and collection identifiers. Changing them later does
not migrate existing data.

Use `seoPlugin({ enabled: false })` to leave a shared Payload configuration
unchanged in an environment where SEO is intentionally disabled.

## After changing configuration

Start Payload or run its build so it can regenerate the import map and Payload
types. Do not hand-edit generated `payload-types.ts` files.
