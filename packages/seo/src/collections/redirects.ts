import type { CollectionConfig, TextField } from 'payload'

import { SEO_PLUGIN_MARKER, type SeoPluginAccess } from '../types.js'
import { isAbsoluteHttpUrl, normalizeRedirectPath } from '../utils/validation.js'

type RedirectData = { destination?: unknown; destinationType?: unknown; enabled?: unknown; source?: unknown }

const deny = () => false

const validatePath = (value: unknown): true | string =>
  normalizeRedirectPath(value) ? true : 'Enter an internal path beginning with one slash, without an origin, query string, or fragment.'

const normalizeRedirectFields = ({ data }: { data?: RedirectData }): RedirectData | undefined => {
  if (!data) return data
  const normalizedSource = normalizeRedirectPath(data.source)
  if (normalizedSource) data.source = normalizedSource
  if (data.destinationType === 'internal') {
    const normalizedDestination = normalizeRedirectPath(data.destination)
    if (normalizedDestination) data.destination = normalizedDestination
  } else if (typeof data.destination === 'string') {
    data.destination = data.destination.trim()
  }
  return data
}

/** Rejects a candidate that creates any enabled internal redirect cycle. */
const validateRedirectGraph = async ({ data, originalDoc, req, slug }: { data?: RedirectData; originalDoc?: RedirectData; req: any; slug: string }) => {
  const candidate = { ...originalDoc, ...data }
  if (candidate.enabled === false || candidate.destinationType !== 'internal') return data
  const source = normalizeRedirectPath(candidate.source)
  const destination = normalizeRedirectPath(candidate.destination)
  if (!source || !destination) return data

  const result = await req.payload.find({ collection: slug, depth: 0, limit: 0, pagination: false, where: { enabled: { equals: true } }, req })
  const redirects = result.docs as Array<RedirectData>
  const bySource = new Map(redirects.map((redirect) => [normalizeRedirectPath(redirect.source), redirect]))
  bySource.set(source, candidate)
  let current = destination
  const visited = new Set<string>()
  for (let remaining = redirects.length + 1; remaining > 0; remaining--) {
    if (current === source || visited.has(current)) throw new Error('Redirects cannot form a loop.')
    visited.add(current)
    const next = bySource.get(current)
    if (!next || next.destinationType !== 'internal') return data
    const normalized = normalizeRedirectPath(next.destination)
    if (!normalized) return data
    current = normalized
  }
  throw new Error('Redirects cannot form a loop.')
}

export const createRedirectsCollection = ({ access, slug }: { access?: SeoPluginAccess['redirects']; slug: string }): CollectionConfig => ({
  slug,
  labels: { singular: 'SEO redirect', plural: 'SEO redirects' },
  timestamps: true,
  access: { admin: access?.admin ?? deny, create: access?.create ?? deny, read: access?.read ?? deny, update: access?.update ?? deny, delete: access?.delete ?? deny },
  admin: { useAsTitle: 'source', defaultColumns: ['source', 'destination', 'statusCode', 'enabled', 'updatedAt'], custom: { seo: { marker: SEO_PLUGIN_MARKER } } },
  hooks: { beforeValidate: [normalizeRedirectFields, (args) => validateRedirectGraph({ ...args, slug })] },
  fields: [
    { name: 'source', type: 'text', required: true, unique: true, index: true, validate: validatePath },
    { name: 'destinationType', type: 'select', required: true, defaultValue: 'internal', options: ['internal', 'external'] },
    { name: 'destination', type: 'text', required: true, validate: (value, { siblingData } = {} as never) =>
      (siblingData as { destinationType?: string } | undefined)?.destinationType === 'external'
        ? isAbsoluteHttpUrl(value) || 'Enter an absolute HTTP or HTTPS URL.'
        : validatePath(value) } as TextField,
    { name: 'statusCode', type: 'select', required: true, defaultValue: '301', options: [{ label: '301 Permanent', value: '301' }, { label: '302 Temporary', value: '302' }] },
    { name: 'enabled', type: 'checkbox', defaultValue: true },
    { name: 'notes', type: 'textarea' },
  ],
})
