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
  const existing = await payload.count({
    collection: 'pages',
    where: {
      slug: {
        equals: 'home',
      },
    },
  })

  if (existing.totalDocs > 0) {
    return
  }

  await payload.create({
    collection: 'pages',
    data: {
      title: 'Home',
      slug: 'home',
      seo: {
        title: 'Home SEO title',
        description: 'Sample SEO description for the local dev app.',
        noIndex: false,
      },
    },
  })
}

export const seed = async (payload: Payload): Promise<void> => {
  await ensureDevUser(payload)
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
