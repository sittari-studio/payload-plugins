import type { SeoDocument } from '../types.js';

export type PreviewFormFields = Record<string, { value?: unknown }>;

const clone = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(clone);
  if (value instanceof Date) return new Date(value);
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, clone(entry)]),
    );
  return value;
};

const isIndex = (value: string): boolean => /^\d+$/.test(value);

const setPath = (document: SeoDocument, path: string, value: unknown): void => {
  const segments = path.split('.').filter(Boolean);
  if (!segments.length) return;
  let target: Record<string, unknown> | unknown[] = document;
  for (let index = 0; index < segments.length - 1; index++) {
    const segment = segments[index]!;
    const nextIsArray = isIndex(segments[index + 1]!);
    if (Array.isArray(target)) {
      const key = Number(segment);
      const current = target[key];
      if (
        !current ||
        typeof current !== 'object' ||
        Array.isArray(current) !== nextIsArray
      )
        target[key] = nextIsArray ? [] : {};
      target = target[key] as Record<string, unknown> | unknown[];
    } else {
      const current = target[segment];
      if (
        !current ||
        typeof current !== 'object' ||
        Array.isArray(current) !== nextIsArray
      )
        target[segment] = nextIsArray ? [] : {};
      target = target[segment] as Record<string, unknown> | unknown[];
    }
  }
  const last = segments.at(-1)!;
  if (Array.isArray(target)) target[Number(last)] = value;
  else target[last] = value;
};

/** Overlays Payload's flattened unsaved form state onto the document loaded by the Admin. */
export const previewDocumentFromForm = (
  savedDocument: unknown,
  fields: PreviewFormFields,
): SeoDocument => {
  const document =
    savedDocument !== null &&
    typeof savedDocument === 'object' &&
    !Array.isArray(savedDocument)
      ? (clone(savedDocument) as SeoDocument)
      : {};
  for (const [path, state] of Object.entries(fields)) {
    if (state.value !== undefined) setPath(document, path, state.value);
  }
  return document;
};
