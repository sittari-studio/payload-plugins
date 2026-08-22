import type { JsonObject } from './types.js';

export const SEO_SCHEMA_STARTERS = {
  WebPage: {
    '@type': 'WebPage',
    name: '$title',
    description: '$description',
    url: '$canonicalUrl',
  },
  Article: {
    '@type': 'Article',
    headline: '$title',
    description: '$description',
    url: '$canonicalUrl',
  },
  Product: {
    '@type': 'Product',
    name: '$title',
    description: '$description',
    url: '$canonicalUrl',
  },
  Organization: { '@type': 'Organization', name: '$title' },
  LocalBusiness: { '@type': 'LocalBusiness', name: '$title' },
  FAQPage: { '@type': 'FAQPage', mainEntity: [], url: '$canonicalUrl' },
} satisfies Record<string, JsonObject>;

export type SeoSchemaStarter = keyof typeof SEO_SCHEMA_STARTERS;

export const createSchemaStarter = (starter?: SeoSchemaStarter): JsonObject =>
  starter ? structuredClone(SEO_SCHEMA_STARTERS[starter]) : {};
