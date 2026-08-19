import { assertValidDocumentPath, isValidDocumentPath } from './path.js'

export type ParsedPaginatedPath = {
  basePath: string
  canonicalPath: string
  isCanonical: boolean
  page: number
}

const assertPage = (page: number): void => {
  if (!Number.isSafeInteger(page) || page < 1) {
    throw new Error(
      '@sittari/payload-path-field: page must be a positive safe integer.',
    )
  }
}

export const buildPaginatedPath = (basePath: string, page: number): string => {
  assertValidDocumentPath(basePath)
  assertPage(page)
  if (page === 1) return basePath

  const trailingSlash = basePath.length > 1 && basePath.endsWith('/')
  const withoutTrailingSlash = trailingSlash ? basePath.slice(0, -1) : basePath
  const prefix = withoutTrailingSlash === '/' ? '' : withoutTrailingSlash
  return `${prefix}/page/${page}${trailingSlash ? '/' : ''}`
}

export const parsePaginatedPath = (
  path: string,
): ParsedPaginatedPath | null => {
  if (!isValidDocumentPath(path)) return null

  const match = /^(.*)\/page\/([^/]+)(\/?)$/.exec(path)
  if (!match) return null

  const [, prefix, rawPage, trailingSlash] = match
  if (!/^[1-9]\d*$/.test(rawPage)) return null

  const page = Number(rawPage)
  if (!Number.isSafeInteger(page)) return null

  const basePrefix = prefix || '/'
  const basePath =
    trailingSlash && basePrefix !== '/' ? `${basePrefix}/` : basePrefix
  if (!isValidDocumentPath(basePath)) return null

  const canonicalPath = buildPaginatedPath(basePath, page)
  return {
    basePath,
    canonicalPath,
    isCanonical: path === canonicalPath,
    page,
  }
}
