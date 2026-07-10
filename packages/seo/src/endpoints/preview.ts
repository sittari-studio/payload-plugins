import { canAccessAdmin, type Endpoint } from 'payload'

import { resolveSeoPreview } from '../helpers/preview.js'
import { SEO_PLUGIN_MARKER, type SeoDocument, type SeoPayload } from '../types.js'

const object = (value: unknown): SeoDocument | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as SeoDocument : undefined

/** Resolves an authenticated Admin form's unsaved values with the production SEO resolver. */
export const createSeoPreviewEndpoint = (collection: string): Omit<Endpoint, 'root'> => ({
  path: '/seo-preview',
  method: 'post',
  handler: async (req) => {
    if (!req.user) return Response.json({ message: 'Unauthorized' }, { status: 401 })
    try {
      await canAccessAdmin({ req })
    } catch {
      return Response.json({ message: 'Forbidden' }, { status: 403 })
    }

    let body: unknown
    try {
      body = await req.json?.()
    } catch {
      return Response.json({ message: 'Invalid preview request.' }, { status: 400 })
    }

    const input = object(body)
    const document = object(input?.document)
    const locale = typeof input?.locale === 'string' ? input.locale : undefined
    if (!document || locale === undefined) return Response.json({ message: 'Invalid preview request.' }, { status: 400 })

    return Response.json(await resolveSeoPreview({ payload: req.payload as unknown as SeoPayload, collection, document, locale }))
  },
  custom: { seo: { marker: SEO_PLUGIN_MARKER } },
})
