import type { SeoPayload } from '../types.js'
import { resolveSeoNames } from '../plugin.js'
import { normalizeRedirectPath, isAbsoluteHttpUrl } from '../utils/validation.js'
import { getSeoRuntimeConfig } from './config.js'

export type SeoRedirect = { destination: string; statusCode: 301 | 302 }

export const findSeoRedirect = async ({ payload, sourcePath }: { payload: SeoPayload; sourcePath: string }): Promise<SeoRedirect | null> => {
  const source = normalizeRedirectPath(sourcePath)
  const config = getSeoRuntimeConfig(payload)
  if (!source || !config || !payload.find) return null
  try {
    const result = await payload.find({ collection: resolveSeoNames(config.names).redirectsCollection, depth: 0, limit: 1, pagination: false, where: { and: [{ source: { equals: source } }, { enabled: { equals: true } }] } })
    const redirect = result.docs[0] ?? {}
    const statusCode = redirect.statusCode === 301 || redirect.statusCode === '301' ? 301 : redirect.statusCode === 302 || redirect.statusCode === '302' ? 302 : undefined
    const destination = redirect.destinationType === 'internal' ? normalizeRedirectPath(redirect.destination) : isAbsoluteHttpUrl(redirect.destination) ? redirect.destination.trim() : null
    return destination && statusCode ? { destination, statusCode } : null
  } catch {
    return null
  }
}
