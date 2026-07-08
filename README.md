# Krameri Payload Plugins

Monorepo for PayloadCMS plugins published under the `@krameri` npm scope.

## Packages

| Package | Description |
| --- | --- |
| `@krameri/payload-shared` | Shared helpers for Krameri Payload plugins. |
| `@krameri/payload-plugin-seo` | Adds reusable SEO fields to selected collections. |

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

This creates `packages/sitemap` with package name `@krameri/payload-plugin-sitemap`.

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
import { seoPlugin } from '@krameri/payload-plugin-seo'

export default buildConfig({
  plugins: [
    seoPlugin({ collections: ['pages', 'posts'] })
  ],
  collections: []
})
```
