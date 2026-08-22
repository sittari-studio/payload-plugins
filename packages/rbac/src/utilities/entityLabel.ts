export type EntityLabel = Record<string, string> | string;

/** Humanizes a slug, e.g. `'site-settings'` → `'Site Settings'`. */
const humanizeSlug = (slug: string): string => {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Resolves a display label for a collection or global at plugin time. Matrix rows
 * cross to the client as serialized props, so string and localized-object labels
 * are retained while label functions fall back to the humanized slug.
 */
export const entityLabel = (label: unknown, slug: string): EntityLabel => {
  if (typeof label === 'string' && label.trim() !== '') {
    return label;
  }

  if (
    label &&
    typeof label === 'object' &&
    Object.values(label).every((entry) => typeof entry === 'string')
  ) {
    return label as Record<string, string>;
  }

  return humanizeSlug(slug);
};
