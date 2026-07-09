# @krameri/payload-seo

PayloadCMS seo plugin.

## Install

```bash
pnpm add @krameri/payload-seo
```

## Usage

```ts
import { buildConfig } from 'payload'
import { seoPlugin } from '@krameri/payload-seo'

export default buildConfig({
  plugins: [seoPlugin()],
  collections: []
})
```
