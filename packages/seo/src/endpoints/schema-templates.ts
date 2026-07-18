import { canAccessAdmin, executeAccess, type Endpoint, type Field, type PayloadRequest } from 'payload'

import type { JsonObject } from '../schema/types.js'
import { SEO_PLUGIN_MARKER } from '../types.js'

const findField = (fields: readonly Field[] | undefined, name: string): Field | undefined => {
  for (const field of fields ?? []) {
    if ('name' in field && field.name === name) return field
    if ('fields' in field && Array.isArray(field.fields)) {
      const found = findField(field.fields, name)
      if (found) return found
    }
    if (field.type === 'tabs') for (const tab of field.tabs) {
      const found = findField(tab.fields, name)
      if (found) return found
    }
  }
  return undefined
}

const localeIsConfigured = (req: PayloadRequest, locale: string | null): locale is string => {
  const configured = req.payload.config.localization
  if (!configured || typeof configured !== 'object' || !configured.locales.length) return locale === null
  if (!locale) return false
  return configured.locales.some((item) => item.code === locale)
}

const defaultLocale = (req: PayloadRequest): string | undefined => {
  const localization = req.payload.config.localization
  if (!localization || typeof localization !== 'object') return undefined
  return localization.defaultLocale
}

const idFromSearch = (value: string | null): number | string | undefined => {
  if (!value) return undefined
  return /^\d+$/.test(value) ? Number(value) : value
}

const settingsTemplates = (settings: Record<string, unknown>, collection: string) => {
  const globals = Array.isArray(settings.globalSchemas) ? settings.globalSchemas : []
  const groups = Array.isArray(settings.collectionSchemas) ? settings.collectionSchemas : []
  const group = groups.find((item) => item && typeof item === 'object' && (item as Record<string, unknown>).collection === collection) as Record<string, unknown> | undefined
  return {
    globalSchemas: globals,
    collectionTemplates: Array.isArray(group?.templates) ? group.templates : [],
  }
}

const fieldCanRead = async (req: PayloadRequest, field: Field | undefined, document?: JsonObject): Promise<boolean> => {
  if (!field || !('access' in field) || typeof field.access?.read !== 'function') return true
  return field.access.read({ req, doc: document, data: document, siblingData: document })
}

/** Returns only templates the current Admin user may use for this collection and locale. */
export const createSchemaTemplatesEndpoint = ({ collection, seoField, settingsGlobal }: { collection: string; seoField: string; settingsGlobal: string }): Omit<Endpoint, 'root'> => ({
  path: '/seo-schema-templates',
  method: 'get',
  handler: async (req) => {
    if (!req.user) return Response.json({ message: 'Unauthorized' }, { status: 401 })
    try { await canAccessAdmin({ req }) } catch { return Response.json({ message: 'Forbidden' }, { status: 403 }) }
    const collectionConfig = req.payload.config.collections.find((candidate) => candidate.slug === collection)
    if (!collectionConfig) return Response.json({ message: 'Not found' }, { status: 404 })
    if (typeof collectionConfig.access?.admin === 'function' && !await collectionConfig.access.admin({ req })) return Response.json({ message: 'Forbidden' }, { status: 403 })

    const url = new URL(req.url ?? 'http://payload.local')
    const requestedLocale = url.searchParams.get('locale')
    if (!localeIsConfigured(req, requestedLocale)) return Response.json({ message: 'Invalid locale' }, { status: 400 })
    const locale = requestedLocale ?? undefined
    const id = idFromSearch(url.searchParams.get('id'))
    let document: JsonObject | undefined
    try {
      if (id !== undefined) document = await req.payload.findByID({ collection, id, locale, fallbackLocale: false, depth: 0, draft: true, overrideAccess: false, req, user: req.user }) as unknown as JsonObject
      else {
        const access = await executeAccess({ req, data: {}, disableErrors: true }, collectionConfig.access?.create)
        if (!access) return Response.json({ message: 'Forbidden' }, { status: 403 })
      }
    } catch { return Response.json({ message: 'Forbidden' }, { status: 403 }) }
    if (!await fieldCanRead(req, findField(collectionConfig.fields, seoField), document)) return Response.json({ message: 'Forbidden' }, { status: 403 })

    try {
      const settings = await req.payload.findGlobal({ slug: settingsGlobal, locale, fallbackLocale: false, depth: 0, overrideAccess: false, req, user: req.user }) as unknown as Record<string, unknown>
      return Response.json({ ...settingsTemplates(settings, collection), defaultLocale: defaultLocale(req) })
    } catch { return Response.json({ message: 'Forbidden' }, { status: 403 }) }
  },
  custom: { seo: { marker: SEO_PLUGIN_MARKER } },
})
