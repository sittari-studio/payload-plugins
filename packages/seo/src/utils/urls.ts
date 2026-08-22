import type { TrailingSlashPolicy } from '../types.js';
import { isAbsoluteHttpUrl } from './validation.js';

export const nonEmptyString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;

export const isSiteRelativePath = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.startsWith('/') &&
  !value.startsWith('//') &&
  !/[?#]/.test(value);

/** A site URL is deliberately an origin. Paths, queries, fragments, and credentials are not site settings. */
export const normalizeSiteUrl = (value: unknown): string | undefined => {
  if (!isAbsoluteHttpUrl(value)) return undefined;
  try {
    const url = new URL(value.trim());
    if (
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    )
      return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
};

export const normalizeCanonicalUrl = (
  value: unknown,
  policy: TrailingSlashPolicy = 'never',
): string | undefined => {
  if (!isAbsoluteHttpUrl(value)) return undefined;
  try {
    const url = new URL(value.trim());
    if (url.search || url.hash) return undefined;
    if (url.pathname !== '/') {
      url.pathname =
        policy === 'always'
          ? `${url.pathname.replace(/\/+$/, '')}/`
          : url.pathname.replace(/\/+$/, '');
    }
    return url.toString();
  } catch {
    return undefined;
  }
};

export const combineSiteUrl = (
  siteUrl: unknown,
  path: unknown,
  policy: TrailingSlashPolicy = 'never',
): string | undefined => {
  const origin = normalizeSiteUrl(siteUrl);
  if (!origin || !isSiteRelativePath(path)) return undefined;
  return normalizeCanonicalUrl(new URL(path, origin).toString(), policy);
};

export const isSameSiteUrl = (siteUrl: unknown, url: unknown): boolean => {
  const origin = normalizeSiteUrl(siteUrl);
  if (!origin || !isAbsoluteHttpUrl(url)) return false;
  return new URL(url).origin === origin;
};
