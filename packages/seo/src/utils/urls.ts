import { isAbsoluteHttpUrl } from './validation.js'

export const nonEmptyString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined

export const isSiteRelativePath = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !/[?#]/.test(value)

export const combineSiteUrl = (siteUrl: unknown, path: unknown): string | undefined => {
  if (!isAbsoluteHttpUrl(siteUrl) || !isSiteRelativePath(path)) return undefined
  try {
    return new URL(path, siteUrl).toString()
  } catch {
    return undefined
  }
}
