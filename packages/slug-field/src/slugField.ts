import type { CheckboxField, RowField, TextField, UIField } from 'payload';
import slugify from 'slugify';

import { localizedText } from './translations/index.js';
import type { CreateSlugFieldOptions } from './types.js';

const SLUG_INSTRUCTION_COMPONENT =
  '@sittari/payload-slug-field/client#SlugInstruction';

const formatSlug = (value: string): string =>
  slugify(value, {
    lower: true,
    replacement: '-',
    strict: true,
  });

export const createSlugField = ({
  instruction,
  localized = true,
  overrides,
  position = 'sidebar',
  required = true,
  useAsSlug = 'title',
}: CreateSlugFieldOptions = {}): RowField => {
  const generateSlug: CheckboxField = {
    name: 'generateSlug',
    type: 'checkbox',
    admin: {
      description:
        'When enabled, the slug will auto-generate from the source field on save and autosave.',
      hidden: true,
    },
    defaultValue: true,
    hooks: {
      beforeChange: [
        ({ data, operation, value }) => {
          if (operation === 'create' && data && !data.slug) {
            const sourceValue = data[useAsSlug];
            if (typeof sourceValue === 'string' && sourceValue.length > 0) {
              data.slug = formatSlug(sourceValue);
            }
          }
          return operation === 'create' ? Boolean(!data?.slug) : value;
        },
      ],
    },
    localized,
  };
  const slug: TextField = {
    name: 'slug',
    type: 'text',
    admin: {
      components: {
        Field: {
          clientProps: { useAsSlug },
          path: '@payloadcms/ui#SlugField',
        },
      },
      width: '100%',
    },
    custom: {
      slugify: ({ valueToSlugify }: { valueToSlugify?: unknown }) =>
        typeof valueToSlugify === 'string' && valueToSlugify.length > 0
          ? formatSlug(valueToSlugify)
          : undefined,
    },
    index: true,
    label: localizedText('slug'),
    localized,
    required,
    unique: true,
    hooks: {
      beforeValidate: [
        ({ value, siblingData }) => {
          if (typeof value === 'string' && value.length > 0) return value;

          const sourceValue = siblingData?.[useAsSlug];
          return typeof sourceValue === 'string' && sourceValue.length > 0
            ? formatSlug(sourceValue)
            : value;
        },
      ],
      beforeChange: [
        ({ value }) =>
          typeof value === 'string' && value.length > 0
            ? formatSlug(value)
            : value,
      ],
    },
  };
  const fields: RowField['fields'] = [generateSlug, slug];

  if (instruction && Object.keys(instruction).length > 0) {
    const instructionField: UIField = {
      name: 'slugInstruction',
      type: 'ui',
      admin: {
        components: {
          Field: SLUG_INSTRUCTION_COMPONENT,
        },
        custom: {
          slugField: {
            instruction,
          },
        },
      },
    };
    fields.push(instructionField);
  }

  const defaultSlugField: RowField = {
    type: 'row',
    admin: { position },
    fields,
  };

  return overrides ? overrides(defaultSlugField) : defaultSlugField;
};
