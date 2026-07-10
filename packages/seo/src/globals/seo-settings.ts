import type { GlobalConfig } from 'payload'

import { SEO_PLUGIN_MARKER, type SeoPluginAccess } from '../types.js'
import { adminLabel, adminTabLabel } from '../admin/translations.js'
import { validateAbsoluteHttpUrl, validateRobotsToken } from '../utils/validation.js'

export const createSeoSettingsGlobal = ({ access, slug, mediaCollection }: { access?: SeoPluginAccess['settings']; slug: string; mediaCollection: string }): GlobalConfig => ({
  slug,
  label: adminLabel('seoSettings'),
  access: { read: access?.read ?? (() => false), update: access?.update ?? (() => false) },
  admin: {
    custom: { seo: { marker: SEO_PLUGIN_MARKER } },
    group: "SEO"
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: adminTabLabel('siteDefaults'),
          fields: [
            { name: 'siteName', type: 'text', label: adminLabel('siteName'), localized: true },
            { name: 'titleTemplate', type: 'text', label: adminLabel('titleTemplate'), localized: true },
            { name: 'defaultDescription', type: 'textarea', label: adminLabel('defaultDescription'), localized: true },
          ],
        },
        {
          label: adminTabLabel('socialDefaults'),
          fields: [
            { name: 'defaultOpenGraphImage', type: 'upload', label: adminLabel('defaultOpenGraphImage'), relationTo: mediaCollection, localized: true },
            { name: 'defaultTwitterCard', type: 'select', label: adminLabel('defaultTwitterCard'), localized: true, options: [{ label: adminLabel('summary'), value: 'summary' }, { label: adminLabel('summaryLargeImage'), value: 'summary_large_image' }] },
            { name: 'defaultOpenGraphType', type: 'text', label: adminLabel('openGraph'), localized: true },
            { name: 'defaultTwitterSite', type: 'text', label: adminLabel('twitter'), localized: true },
            { name: 'defaultTwitterCreator', type: 'text', label: adminLabel('author'), localized: true },
            { name: 'defaultLocale', type: 'text', label: adminLabel('siteDefaults'), localized: true },
          ],
        },
        {
          label: adminTabLabel('defaultRobots'),
          fields: [{
            name: 'defaultRobots', type: 'group', label: adminLabel('defaultRobots'), localized: true, fields: [
              { name: 'mode', type: 'select', label: adminLabel('defaultRobots'), required: true, defaultValue: 'index-follow', options: [{ label: 'Index, follow', value: 'index-follow' }, { label: 'No index, follow', value: 'noindex-follow' }, { label: 'Index, nofollow', value: 'index-nofollow' }, { label: 'No index, nofollow', value: 'noindex-nofollow' }, { label: 'Custom directives', value: 'custom' }] },
              { name: 'directives', type: 'text', label: adminLabel('robots'), admin: { condition: (_, siblingData) => siblingData?.mode === 'custom' } },
            ]
          }],
        },
        {
          label: adminTabLabel('organizationSchema'),
          fields: [{
            name: 'organizationSchema', type: 'group', label: adminLabel('organizationSchema'), localized: true, fields: [
              { name: 'name', type: 'text', label: adminLabel('organizationName') }, { name: 'url', type: 'text', label: adminLabel('organizationUrl'), validate: validateAbsoluteHttpUrl }, { name: 'logo', type: 'upload', label: adminLabel('organizationLogo'), relationTo: mediaCollection },
              { name: 'sameAs', type: 'array', label: adminLabel('organizationSchema'), fields: [{ name: 'url', type: 'text', label: adminLabel('organizationUrl'), validate: validateAbsoluteHttpUrl }] },
            ]
          }],
        },
        {
          label: adminTabLabel('robotsTxt'),
          fields: [{
            name: 'robots', type: 'group', label: adminLabel('robots'), localized: true, fields: [
              { name: 'mode', type: 'select', label: adminLabel('robotsMode'), required: true, defaultValue: 'generated', options: [{ label: adminLabel('generated'), value: 'generated' }, { label: adminLabel('override'), value: 'override' }] },
              {
                name: 'groups', type: 'array', label: adminLabel('groups'), fields: [
                  { name: 'userAgent', type: 'text', label: adminLabel('userAgent'), required: true, validate: validateRobotsToken },
                  { name: 'allow', type: 'array', label: adminLabel('allow'), fields: [{ name: 'path', type: 'text', label: adminLabel('path'), validate: validateRobotsToken }] },
                  { name: 'disallow', type: 'array', label: adminLabel('disallow'), fields: [{ name: 'path', type: 'text', label: adminLabel('path'), validate: validateRobotsToken }] },
                ]
              },
              { name: 'overrideText', type: 'textarea', label: adminLabel('overrideText'), admin: { condition: (_, siblingData) => siblingData?.mode === 'override' } },
            ]
          }],
        },
      ],
    },
  ],
})
