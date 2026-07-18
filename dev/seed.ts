import type { Payload, SanitizedConfig } from 'payload'

import { getPayload } from 'payload'

export const devUser = {
  email: 'dev@example.com',
  password: 'password',
}

const getDocumentID = (doc: unknown): number | string | undefined => {
  if (!doc || typeof doc !== 'object' || !('id' in doc)) {
    return undefined
  }

  const { id } = doc

  return typeof id === 'number' || typeof id === 'string' ? id : undefined
}

const ensureDevUser = async (payload: Payload): Promise<void> => {
  const existing = await payload.find({
    collection: 'users',
    depth: 0,
    limit: 1,
    where: {
      email: {
        equals: devUser.email,
      },
    },
  })

  if (getDocumentID(existing.docs[0])) {
    return
  }

  await payload.create({
    collection: 'users',
    data: devUser,
  })
}

const ensureSamplePage = async (payload: Payload): Promise<void> => {
  const existing = await payload.find({
    collection: 'pages',
    depth: 0,
    limit: 1,
    where: {
      slug: {
        equals: 'home',
      },
    },
  })

  const page = existing.docs[0]
  if (page) {
    if ((page as { seo?: unknown }).seo) {
      return
    }

    const id = getDocumentID(page)
    if (!id) {
      return
    }

    await payload.update({
      collection: 'pages',
      id,
      data: {
        seo: {
          title: 'Home SEO title',
          description: 'Sample SEO description for the local dev app.',
          canonical: { mode: 'auto' },
          robots: { mode: 'index-follow' },
          schemaInstances: [{ templateId: 'web-page' }],
        },
      },
    })
    return
  }

  await payload.create({
    collection: 'pages',
    draft: false,
    data: {
      title: 'Home',
      slug: 'home',
      pageType: 'standardContent',
      seo: {
        title: 'Home SEO title',
        description: 'Sample SEO description for the local dev app.',
        canonical: { mode: 'auto' },
        robots: { mode: 'index-follow' },
      },
    },
  })
}

const ensureSeoSettings = async (payload: Payload): Promise<void> => {
  const settings = await payload.findGlobal({
    slug: 'seo-settings',
  })

  if (typeof settings.siteName === 'string' && settings.siteName) {
    return
  }

  await payload.updateGlobal({
    slug: 'seo-settings',
    data: {
      siteName: 'Sittari development',
      titleTemplate: '%s | Sittari development',
      defaultDescription: 'Development content for the Payload SEO plugin.',
      defaultRobots: { mode: 'index-follow' },
      collectionSchemas: [{
        collection: 'pages',
        templates: [{ templateId: 'web-page', name: 'WebPage', schema: { '@type': 'WebPage', name: '$title', description: '$excerpt' }, isDefault: true }],
      }],
      globalSchemas: [{ templateId: 'website', name: 'WebSite', schema: { '@type': 'WebSite', name: 'Sittari development' } }],
      robots: {
        mode: 'generated',
        groups: [{ userAgent: '*', disallow: [{ path: '/admin' }] }],
      },
    },
  })
}

export const seed = async (payload: Payload): Promise<void> => {
  await ensureDevUser(payload)
  await ensureSeoSettings(payload)
  await ensureSamplePage(payload)
}

export const script = async (config: SanitizedConfig): Promise<void> => {
  const payload = await getPayload({
    config,
    disableOnInit: true,
  })

  try {
    await seed(payload)
  } finally {
    await payload.destroy()
  }
}
