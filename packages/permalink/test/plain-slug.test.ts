import type { Config, Field } from 'payload';
import { describe, expect, it } from 'vitest';

import { permalinkPlugin } from '../src/index.js';

const findField = (fields: Field[], name: string): Field | undefined => {
  for (const field of fields) {
    if ('name' in field && field.name === name) return field;
    if ('fields' in field && Array.isArray(field.fields)) {
      const nested = findField(field.fields, name);
      if (nested) return nested;
    }
  }
  return undefined;
};

describe('plain permalink slug field', () => {
  it('adds a hidden non-unique text field without Payload slugField behavior', () => {
    const input = {
      collections: [
        {
          slug: 'pages',
          admin: { useAsTitle: 'title' },
          fields: [{ name: 'title', type: 'text' }],
        },
      ],
    } as unknown as Config;

    const output = permalinkPlugin({
      collections: { pages: { prefix: '' } },
      siteUrl: 'https://example.com',
    })(input) as Config;

    const pages = output.collections?.find(({ slug }) => slug === 'pages');
    const slug = findField(pages?.fields ?? [], 'slug');

    expect(slug).toMatchObject({
      name: 'slug',
      type: 'text',
      localized: false,
      admin: { hidden: true },
    });
    expect(slug && 'unique' in slug ? slug.unique : undefined).not.toBe(true);
    expect(slug && 'index' in slug ? slug.index : undefined).not.toBe(true);
    expect(slug && 'hooks' in slug ? slug.hooks : undefined).toBeUndefined();
  });
});
