const UNSAFE_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i

export const validateUrl = (value: null | string | undefined): true | string => {
  if (!value) {
    return true
  }

  const trimmed = value.trim()

  if (!trimmed) {
    return true
  }

  if (trimmed.startsWith('//')) {
    return 'Protocol-relative URLs are not allowed.'
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
        : 'Only http and https URLs are allowed.'
    } catch {
      return 'Enter a valid URL.'
    }
  }

  return true
}

export const isValidUrl = (value: null | string | undefined): boolean =>
  validateUrl(value) === true
