import type { GlobalConfig } from 'payload'

import { SEO_PLUGIN_MARKER, type SeoPluginAccess } from '../types.js'
import { validateAbsoluteHttpUrl } from '../utils/validation.js'

export const createSeoSettingsGlobal = ({ access, slug, mediaCollection }: { access?: SeoPluginAccess['settings']; slug: string; mediaCollection: string }): GlobalConfig => ({
  slug,
  label: 'SEO settings',
  access: { read: access?.read ?? (() => false), update: access?.update ?? (() => false) },
  admin: { custom: { seo: { marker: SEO_PLUGIN_MARKER } } },
  fields: [
    { name: 'siteName', type: 'text', localized: true },
    { name: 'siteUrl', type: 'text', required: true, validate: validateAbsoluteHttpUrl },
    { name: 'titleTemplate', type: 'text', localized: true },
    { name: 'defaultDescription', type: 'textarea', localized: true },
    { name: 'defaultOpenGraphImage', type: 'upload', relationTo: mediaCollection, localized: true },
    { name: 'defaultTwitterCard', type: 'select', localized: true, options: ['summary', 'summary_large_image'] },
    { name: 'defaultRobots', type: 'group', localized: true, fields: [
      { name: 'index', type: 'select', options: ['index', 'noindex'], defaultValue: 'index' },
      { name: 'follow', type: 'select', options: ['follow', 'nofollow'], defaultValue: 'follow' },
    ] },
    { name: 'organizationSchema', type: 'group', localized: true, fields: [
      { name: 'name', type: 'text' }, { name: 'url', type: 'text', validate: validateAbsoluteHttpUrl }, { name: 'logo', type: 'upload', relationTo: mediaCollection },
    ] },
    { name: 'robots', type: 'group', localized: true, fields: [
      { name: 'mode', type: 'select', required: true, defaultValue: 'generated', options: ['generated', 'override'] },
      { name: 'groups', type: 'array', fields: [
        { name: 'userAgent', type: 'text', required: true },
        { name: 'allow', type: 'array', fields: [{ name: 'path', type: 'text' }] },
        { name: 'disallow', type: 'array', fields: [{ name: 'path', type: 'text' }] },
      ] },
      { name: 'appendText', type: 'textarea' },
      { name: 'overrideText', type: 'textarea', admin: { condition: (_, siblingData) => siblingData?.mode === 'override' } },
    ] },
  ],
})
