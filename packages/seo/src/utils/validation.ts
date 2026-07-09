export const isAbsoluteHttpUrl = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.trim() === '') return false

  try {
    const url = new URL(value.trim())
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname !== ''
  } catch {
    return false
  }
}

/** Normalizes only surrounding whitespace; pathname identity otherwise stays exact. */
export const normalizeRedirectPath = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const path = value.trim()
  if (!path.startsWith('/') || path.startsWith('//')) return null

  try {
    const url = new URL(path, 'https://payload-seo.invalid')
    if (url.origin !== 'https://payload-seo.invalid' || url.search || url.hash) return null
    return path
  } catch {
    return null
  }
}

import { adminText } from '../admin/translations.js'
import { normalizeSiteUrl } from './urls.js'

type ValidationContext = { req?: { i18n?: { language?: string } } }

const validationText = (key: 'validationAbsoluteHttpUrl' | 'validationJson', context?: ValidationContext): string =>
  adminText(key, context?.req?.i18n?.language)

export const validateAbsoluteHttpUrl = (value: unknown, context?: ValidationContext): true | string =>
  value === undefined || value === null || value === '' || isAbsoluteHttpUrl(value)
    ? true
    : validationText('validationAbsoluteHttpUrl', context)

export const isPlainJsonObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype

export const validateJson = (value: unknown, context?: ValidationContext): true | string => {
  if (value === undefined || value === null || value === '') return true
  if (typeof value !== 'string') return validationText('validationJson', context)
  try {
    return isPlainJsonObject(JSON.parse(value)) ? true : validationText('validationJson', context)
  } catch {
    return validationText('validationJson', context)
  }
}

export const validateSiteUrl = (value: unknown, context?: ValidationContext): true | string =>
  value === undefined || value === null || value === '' || normalizeSiteUrl(value)
    ? true
    : validationText('validationAbsoluteHttpUrl', context)

export const hasLineBreak = (value: unknown): boolean => typeof value === 'string' && /[\r\n]/.test(value)

export const validateRobotsToken = (value: unknown, context?: ValidationContext): true | string =>
  value === undefined || value === null || value === '' || (typeof value === 'string' && !hasLineBreak(value))
    ? true
    : validationText('validationAbsoluteHttpUrl', context)
