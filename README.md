# Krameri Payload Plugins

Monorepo for PayloadCMS plugins published under the `@krameri` npm scope.

## Packages

| Package | Description |
| --- | --- |
| `@krameri/payload-shared` | Shared helpers for Krameri Payload plugins. |
| `@krameri/payload-seo` | Locale-safe SEO fields, English/Russian/Ukrainian Admin UI, and framework-neutral metadata, robots, redirect, and sitemap helpers. |

The `dev` workspace is a private local Payload app for testing packages during development.

## Requirements

- Node.js 20+
- pnpm 11+
- npm account with access to the `@krameri` scope

## Install

```bash
pnpm install
```

## Build

```bash
pnpm build
```

Publishable packages build with `tsdown` as ESM-only packages. JavaScript and TypeScript declaration files are emitted to each package's `dist` directory.

## Plugin development

```bash
pnpm dev:plugins
```

This watches only `packages/*` plugin packages. It continuously emits JavaScript and TypeScript declarations to each package's `dist` directory and copies plugin admin CSS assets when they change.

## Typecheck

```bash
pnpm typecheck
```

## Test

```bash
pnpm test
```

## Create another plugin

```bash
pnpm create:plugin sitemap
```

This creates `packages/sitemap` with package name `@krameri/payload-sitemap`.

## Publish

```bash
pnpm changeset
pnpm version
pnpm release
```

Every public scoped package includes:

```json
{
  "publishConfig": {
    "access": "public"
  }
}
```

## Usage example

```ts
import { buildConfig } from 'payload'
import { seoPlugin } from '@krameri/payload-seo'

export default buildConfig({
  plugins: [
    seoPlugin({
      collections: { pages: { schemaType: 'WebPage' } },
      media: { collection: 'media', resolveMediaUrl: () => null },
      resolveUrl: () => null,
      resolveChunkUrl: () => 'https://example.com/sitemap.xml',
    })
  ],
  collections: []
})
```
