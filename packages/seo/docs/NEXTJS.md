# Next.js App Router integration

The plugin is framework-neutral. This guide shows how to connect its helpers to
a Next.js App Router application. Adapt the collection lookup and locale
validation to your application.

## Page metadata

Use the `next` subpath in `generateMetadata`. The helper accepts the already
loaded document, so the page query can be shared with page rendering.

```ts
import type { Metadata } from 'next'
import { getPayload } from 'payload'
import { resolveNextMetadata } from '@sittari/payload-seo/next'

import config from '@payload-config'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'pages',
    locale,
    fallbackLocale: false,
    draft: false,
    depth: 1,
    limit: 1,
    where: { slug: { equals: slug } },
  })
  const page = result.docs[0]

  if (!page) return {}

  return await resolveNextMetadata({
    payload,
    collection: 'pages',
    document: page,
    locale,
  }) as Metadata
}
```

Use `depth` high enough to populate any SEO image relationship used by
`resolveMediaUrl`. The resolver only returns data; returning it from
`generateMetadata` is what makes Next.js render the metadata.

## robots.txt

Create a route handler and choose the locale that owns your robots policy. For
a single-locale site, use a fixed locale. For a localized site, route to an
explicit locale or define a deliberate default.

```ts
import { getPayload } from 'payload'
import { renderRobotsTxt } from '@sittari/payload-seo'

import config from '@payload-config'

export async function GET() {
  const payload = await getPayload({ config })
  const body = await renderRobotsTxt({ payload, locale: 'en' })

  return new Response(body, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}
```

Place it at `app/robots.txt/route.ts` if that matches your routing structure.

## Sitemap index and chunks

The plugin produces sitemap text; your routes return it. First add an index
route:

```ts
import { getPayload } from 'payload'
import { renderSitemapIndexXml } from '@sittari/payload-seo'

import config from '@payload-config'

export async function GET() {
  const payload = await getPayload({ config })
  const body = await renderSitemapIndexXml({ payload })

  return new Response(body, {
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  })
}
```

Then implement routes that match the URLs returned by `resolveChunkUrl`. A
chunk handler calls `renderSitemapXml` with validated route parameters:

```ts
import { getPayload } from 'payload'
import { renderSitemapXml } from '@sittari/payload-seo'

import config from '@payload-config'

const collections = new Set(['pages', 'posts'])

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ collection: string; locale: string; page: string }> },
) {
  const { collection, locale, page: pageParam } = await params
  const page = Number(pageParam)

  if (!collections.has(collection) || !Number.isInteger(page) || page < 1) {
    return new Response('Not found', { status: 404 })
  }

  const payload = await getPayload({ config })
  const body = await renderSitemapXml({ payload, collection, locale, page })

  return new Response(body, {
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  })
}
```

Add caching appropriate for how often content changes. Keep the collection and
locale validation in your route: the helper intentionally has no knowledge of
your public URL scheme.

## Applying redirects

Call `findSeoRedirect` from a Node.js server route or request layer after you
have a Payload instance. Do not assume an Edge middleware can initialize your
Payload database adapter.

```ts
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { findSeoRedirect } from '@sittari/payload-seo'

import config from '@payload-config'

export async function redirectIfConfigured(request: Request) {
  const payload = await getPayload({ config })
  const sourcePath = new URL(request.url).pathname
  const redirect = await findSeoRedirect({ payload, sourcePath })

  return redirect
    ? NextResponse.redirect(new URL(redirect.destination, request.url), redirect.statusCode)
    : null
}
```

Apply it at a point that does not conflict with your normal page routes. The
helper deliberately ignores query strings and does not perform the redirect for
you.
