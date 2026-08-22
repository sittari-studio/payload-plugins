import type { ClientField } from 'payload';

const PLACEHOLDER_FIELD_TYPES = new Set([
  'code',
  'date',
  'email',
  'number',
  'select',
  'text',
  'textarea',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const getPlaceholder = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value || undefined;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === 'string' || typeof item === 'number')
  ) {
    return value.join(', ');
  }

  return undefined;
};

const getFieldValue = (
  field: ClientField,
  templateData: Record<string, unknown>,
): unknown =>
  'name' in field && typeof field.name === 'string'
    ? templateData[field.name]
    : templateData;

const applyFieldPlaceholder = (
  field: ClientField,
  templateData: Record<string, unknown>,
): ClientField => {
  const fieldValue = getFieldValue(field, templateData);

  if (field.type === 'row' || field.type === 'collapsible') {
    return {
      ...field,
      fields: applyTemplatePlaceholders(field.fields, templateData),
    };
  }

  if (field.type === 'tabs') {
    return {
      ...field,
      tabs: field.tabs.map((tab) => {
        const tabValue =
          'name' in tab && typeof tab.name === 'string'
            ? templateData[tab.name]
            : templateData;

        return {
          ...tab,
          fields: applyTemplatePlaceholders(
            tab.fields,
            isRecord(tabValue) ? tabValue : {},
          ),
        };
      }),
    };
  }

  if (field.type === 'group') {
    return {
      ...field,
      fields: applyTemplatePlaceholders(
        field.fields,
        isRecord(fieldValue) ? fieldValue : {},
      ),
    };
  }

  if (!PLACEHOLDER_FIELD_TYPES.has(field.type)) {
    return field;
  }

  const placeholder = getPlaceholder(fieldValue);
  if (placeholder === undefined) {
    return field;
  }

  return {
    ...field,
    admin: {
      ...field.admin,
      placeholder,
    },
  } as ClientField;
};

export const applyTemplatePlaceholders = (
  fields: ClientField[],
  templateData: Record<string, unknown>,
): ClientField[] =>
  fields.map((field) => applyFieldPlaceholder(field, templateData));
