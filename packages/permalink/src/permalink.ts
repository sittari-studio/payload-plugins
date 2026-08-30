import { joinPathSegments } from './path.js';

export const HOME_SLUG = '__home';

export const normalizeSiteUrl = (siteUrl: string): string =>
  siteUrl.replace(/\/+$/g, '');

export const normalizePath = (path: unknown): string | null => {
  if (typeof path !== 'string' || path.length === 0) return null;
  return path.startsWith('/') ? path : `/${path}`;
};

export const joinUrl = (siteUrl: string, path: string): string =>
  `${normalizeSiteUrl(siteUrl)}${path === '/' ? '/' : path}`;

export const permalinkDisplayPath = (
  storedPath: string | null,
  slug: string,
  prefix = '',
  storedSlug = slug,
): string => {
  if (!storedPath) {
    return joinPathSegments(prefix, slug === HOME_SLUG ? undefined : slug);
  }
  if (slug === storedSlug) return storedPath;
  if (storedSlug === HOME_SLUG) {
    return joinPathSegments(storedPath, slug === HOME_SLUG ? undefined : slug);
  }

  const storedSlugSuffix = `/${storedSlug}`;
  if (!storedPath.endsWith(storedSlugSuffix)) return storedPath;

  const parentPath = storedPath.slice(0, -storedSlugSuffix.length);
  return joinPathSegments(parentPath, slug === HOME_SLUG ? undefined : slug);
};

export const permalinkPrefix = ({
  path,
  prefix,
  siteUrl,
}: {
  path: string | null;
  prefix: string;
  siteUrl: string;
}): string => {
  const base = normalizeSiteUrl(siteUrl);
  if (!path) {
    const provisional = joinPathSegments(prefix);
    return provisional === '/' ? `${base}/` : `${base}${provisional}/`;
  }
  if (path === '/') return `${base}/`;
  return `${base}${path.slice(0, path.lastIndexOf('/') + 1)}`;
};
