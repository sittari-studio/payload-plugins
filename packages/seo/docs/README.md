# Integrating `@sittari/payload-seo`

`@sittari/payload-seo` adds localized SEO editing fields to selected Payload
collections, a site-wide SEO settings Global, and a redirects collection. It
also exports server helpers that resolve metadata and render robots and sitemap
content.

The package deliberately does **not** register frontend routes or render HTML
tags. Your application supplies those integration points, which keeps the
plugin usable with Next.js and other Payload frontends.

## Integration path

1. [Install and configure the plugin in Payload](PAYLOAD_INTEGRATION.md).
2. Set `siteUrl` in the plugin configuration from the host environment, then
   configure editor-managed defaults in the **SEO Settings** Global.
3. Call the [runtime helpers](PUBLIC_API.md) from your frontend.
4. If you use Next.js App Router, adapt them with the [Next.js examples](NEXTJS.md).

## Guides

| Guide                                         | Use it for                                                                 |
| --------------------------------------------- | -------------------------------------------------------------------------- |
| [Payload integration](PAYLOAD_INTEGRATION.md) | Installation, plugin configuration, generated content, and access control. |
| [Public API](PUBLIC_API.md)                   | Plugin options, resolver contracts, helper behavior, and public types.     |
| [Next.js App Router](NEXTJS.md)               | `generateMetadata`, robots.txt, sitemap, and redirect route examples.      |
| [Admin translations](ADMIN_TRANSLATIONS.md)   | Supported Admin interface languages and stable stored values.              |

## Important defaults

- Only collections listed in `collections` receive an SEO group.
- The plugin reads only the requested locale and never falls back to another
  locale when resolving public SEO output.
- Runtime helpers read published content only. Preview and draft delivery stay
  application concerns.
- The Settings Global and redirects collection deny access by default. Configure
  `access` if editors should manage them.
- Generated names default to `seo`, `seo-settings`, and `seo-redirects`. Treat
  a name change as a content migration.
