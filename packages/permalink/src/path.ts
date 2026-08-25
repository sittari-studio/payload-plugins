const URI_SCHEME = /[A-Za-z][A-Za-z\d+.-]*:/;

const hasControlCharacter = (value: string): boolean => {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
};

export const validateDocumentPath = (path: unknown): string | true => {
  if (typeof path !== 'string' || path.length === 0) {
    return 'Path must be a non-empty string.';
  }
  if (!path.startsWith('/')) {
    return 'Path must begin with "/".';
  }
  if (path.startsWith('//')) {
    return 'Path cannot use a protocol-relative prefix.';
  }
  if (path.includes('?') || path.includes('#')) {
    return 'Path cannot contain a query string or fragment.';
  }
  if (path.includes('\\')) {
    return 'Path cannot contain backslashes.';
  }
  if (hasControlCharacter(path)) {
    return 'Path cannot contain control characters.';
  }
  if (URI_SCHEME.test(path)) {
    return 'Path cannot contain a URI scheme.';
  }
  return true;
};

export const isValidDocumentPath = (path: unknown): path is string =>
  validateDocumentPath(path) === true;

export const assertValidDocumentPath: (
  path: unknown,
) => asserts path is string = (path) => {
  const result = validateDocumentPath(path);
  if (result !== true) {
    throw new Error(
      `@sittari/payload-path-field: invalid resolved path. ${result}`,
    );
  }
};

export const cleanPathSegment = (segment: string): string =>
  segment
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .replace(/\s+/g, '-');

export const joinPathSegments = (
  ...segments: Array<null | string | undefined>
): string => {
  const cleaned = segments
    .filter((segment): segment is string => typeof segment === 'string')
    .map(cleanPathSegment)
    .filter(Boolean);

  return cleaned.length === 0 ? '/' : `/${cleaned.join('/')}`;
};
