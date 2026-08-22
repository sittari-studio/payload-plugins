import { nonEmptyString } from './urls.js';

const simple = new Set([
  'noarchive',
  'nosnippet',
  'noimageindex',
  'notranslate',
]);
const indexFollow = new Set(['index', 'noindex', 'follow', 'nofollow']);

/**
 * Returns only directives that can be represented by the framework-neutral and
 * Next adapters. Values are normalized to the robots token spelling.
 */
export const normalizeRobotsDirectives = (value: unknown): string[] => {
  const seen = new Set<string>();
  const directives: string[] = [];
  const add = (candidate: string): void => {
    const directive = candidate.trim().toLowerCase();
    if (!directive || seen.has(directive)) return;
    const supported =
      simple.has(directive) ||
      indexFollow.has(directive) ||
      /^max-snippet:-?\d+$/.test(directive) ||
      /^max-video-preview:-?\d+$/.test(directive) ||
      /^max-image-preview:(none|standard|large)$/.test(directive) ||
      /^unavailable_after:.+$/.test(directive);
    if (supported) {
      seen.add(directive);
      directives.push(directive);
    }
  };
  if (Array.isArray(value))
    value.forEach(
      (item) => typeof item === 'string' && item.split(',').forEach(add),
    );
  else nonEmptyString(value)?.split(',').forEach(add);
  return directives;
};

export const robotsContent = (robots: {
  index?: 'index' | 'noindex';
  follow?: 'follow' | 'nofollow';
  custom?: string[];
}): string =>
  [
    robots.index,
    robots.follow,
    ...(robots.custom ?? []).filter((value) => !indexFollow.has(value)),
  ]
    .filter((value): value is string => Boolean(value))
    .join(', ');
