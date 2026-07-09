export const isAbsoluteHttpUrl = (value: unknown): boolean => {
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

export const validateAbsoluteHttpUrl = (value: unknown): true | string =>
  value === undefined || value === null || value === '' || isAbsoluteHttpUrl(value)
    ? true
    : 'Enter an absolute HTTP or HTTPS URL.'

export const validateJson = (value: unknown): true | string => {
  if (value === undefined || value === null || value === '') return true
  if (typeof value !== 'string') return 'Enter valid JSON.'
  try {
    JSON.parse(value)
    return true
  } catch {
    return 'Enter valid JSON.'
  }
}
