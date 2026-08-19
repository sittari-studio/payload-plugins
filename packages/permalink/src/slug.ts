import type { TextField } from 'payload'
import slugify from 'slugify'

import { HOME_SLUG } from './permalink.js'

export const formatPermalinkSlug = (value: string, locale?: string): string => {
  if (value === HOME_SLUG) return HOME_SLUG

  return slugify(value, {
    ...(locale ? { locale } : {}),
    lower: true,
    replacement: '-',
    strict: true,
  })
}

export const createPermalinkSlugField = ({
  localized,
}: {
  localized: boolean
}): TextField => ({
  name: 'slug',
  type: 'text',
  localized,
  admin: {
    hidden: true,
  },
})
