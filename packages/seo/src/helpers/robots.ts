import type { SeoDocument, SeoPayload } from '../types.js'
import { resolveSeoNames } from '../plugin.js'
import { loadSettingsWithoutFallback } from '../utils/locale.js'
import { nonEmptyString } from '../utils/urls.js'
import { getSeoRuntimeConfig } from './config.js'

const object = (value: unknown): SeoDocument => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as SeoDocument : {}

export const renderRobotsTxt = async ({ payload, locale }: { payload: SeoPayload; locale: string }): Promise<string> => {
  const config = getSeoRuntimeConfig(payload)
  if (!config) return ''
  try {
    const settings = await loadSettingsWithoutFallback({ payload, slug: resolveSeoNames(config.names).settingsGlobal, locale })
    const robots = object(settings.robots)
    if (robots.mode === 'override') return typeof robots.overrideText === 'string' ? robots.overrideText : ''
    const groups = Array.isArray(robots.groups) ? robots.groups : []
    const sections = groups.flatMap((group) => {
      const value = object(group)
      const userAgent = nonEmptyString(value.userAgent)
      if (!userAgent) return []
      const lines = [`User-agent: ${userAgent}`]
      for (const allow of Array.isArray(value.allow) ? value.allow : []) {
        const path = nonEmptyString(object(allow).path)
        if (path) lines.push(`Allow: ${path}`)
      }
      for (const disallow of Array.isArray(value.disallow) ? value.disallow : []) {
        const path = nonEmptyString(object(disallow).path)
        if (path) lines.push(`Disallow: ${path}`)
      }
      return [lines.join('\n')]
    })
    const sitemapUrls = config.robots?.resolveSitemapUrls ? await config.robots.resolveSitemapUrls({ locale }) : []
    const sitemapLines = sitemapUrls.filter((url) => typeof url === 'string' && url.trim()).map((url) => `Sitemap: ${url.trim()}`)
    if (sitemapLines.length) sections.push(sitemapLines.join('\n'))
    const appendText = nonEmptyString(robots.appendText)
    if (appendText) sections.push(appendText)
    return sections.join('\n\n')
  } catch {
    return ''
  }
}
