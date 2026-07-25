import { translate } from '../translations/index.js'

const UNSAFE_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i

export const validateUrl = (
  value: null | string | undefined,
  language?: string,
): true | string => {
  if (!value) {
    return true
  }

  const trimmed = value.trim()

  if (!trimmed) {
    return true
  }

  if (trimmed.startsWith('//')) {
    return translate('protocolRelativeUrl', language)
  }

  if (trimmed.startsWith('#')) {
    return true
  }

  if (trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../')) {
    return true
  }

  if (trimmed.startsWith('?')) {
    return true
  }

  if (UNSAFE_SCHEME_PATTERN.test(trimmed)) {
    try {
      const url = new URL(trimmed)

      return url.protocol === 'http:' || url.protocol === 'https:'
        ? true
        : translate('onlyHttpUrls', language)
    } catch {
      return translate('enterValidUrl', language)
    }
  }

  return true
}

export const isValidUrl = (value: null | string | undefined): boolean =>
  validateUrl(value) === true
