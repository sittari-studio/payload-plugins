import type { Field } from 'payload';
import { describe, expect, it } from 'vitest';

import { createSlugField } from '../src/index.js';

const getNamedField = (fields: Field[], name: string) =>
  fields.find((field) => 'name' in field && field.name === name);

describe('createSlugField', () => {
  it('creates a localized, required slug row without an instruction by default', () => {
    const field = createSlugField();

    expect(field).toMatchObject({
      type: 'row',
      admin: { position: 'sidebar' },
    });
    expect(getNamedField(field.fields, 'slug')).toMatchObject({
      required: true,
      localized: true,
      label: { en: 'Slug', ru: 'Слаг', uk: 'Слаг' },
    });
    expect(getNamedField(field.fields, 'slugInstruction')).toBeUndefined();
  });

  it('adds locale-keyed instruction text only when configured', () => {
    const field = createSlugField({
      instruction: {
        en: 'Use home for the front page.',
        uk: 'Для головної сторінки використовуйте home.',
      },
    });

    expect(getNamedField(field.fields, 'slugInstruction')).toMatchObject({
      type: 'ui',
      admin: {
        custom: {
          slugField: { instruction: { en: 'Use home for the front page.' } },
        },
      },
    });
  });

  it('allows the completed row to be overridden', () => {
    const field = createSlugField({
      useAsSlug: 'name',
      localized: false,
      overrides: (defaultSlugField) => ({
        ...defaultSlugField,
        admin: { position: 'sidebar' },
      }),
    });

    expect(field.admin?.position).toBe('sidebar');
    expect(getNamedField(field.fields, 'slug')).toMatchObject({
      localized: false,
    });
  });

  it('generates an empty slug before required validation', async () => {
    const field = createSlugField();
    const slug = getNamedField(field.fields, 'slug');

    if (!slug || slug.type !== 'text')
      throw new Error('Expected a text slug field');
    const beforeValidate = slug.hooks?.beforeValidate?.[0];

    if (!beforeValidate) throw new Error('Expected a slug beforeValidate hook');

    expect(
      beforeValidate({
        value: undefined,
        siblingData: { title: 'A New Page' },
      } as unknown as Parameters<typeof beforeValidate>[0]),
    ).toBe('a-new-page');
  });

  it('preserves a manually entered slug before validation', async () => {
    const field = createSlugField();
    const slug = getNamedField(field.fields, 'slug');

    if (!slug || slug.type !== 'text')
      throw new Error('Expected a text slug field');
    const beforeValidate = slug.hooks?.beforeValidate?.[0];

    if (!beforeValidate) throw new Error('Expected a slug beforeValidate hook');

    expect(
      beforeValidate({
        value: 'custom-path',
        siblingData: { title: 'A New Page' },
      } as unknown as Parameters<typeof beforeValidate>[0]),
    ).toBe('custom-path');
  });

  it('leaves the slug unset when its source is empty', async () => {
    const field = createSlugField();
    const generateSlug = getNamedField(field.fields, 'generateSlug');

    if (!generateSlug || generateSlug.type !== 'checkbox')
      throw new Error('Expected a slug generation checkbox');
    const beforeChange = generateSlug.hooks?.beforeChange?.[0];

    if (!beforeChange) throw new Error('Expected a slug generation hook');

    const data: Record<string, unknown> = {};
    await beforeChange({
      data,
      operation: 'create',
      value: true,
    } as unknown as Parameters<typeof beforeChange>[0]);

    expect(data.slug).toBeUndefined();
  });
});
