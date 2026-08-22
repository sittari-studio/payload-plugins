import type { Field, GroupField } from 'payload';

import type { TemplateFieldConfig } from './types.js';

export const TEMPLATE_FIELD_MARKER =
  '@sittari/payload-templates/template-field';

type TemplateFieldCustom = {
  templateField?: {
    marker?: unknown;
    template?: unknown;
  };
};

export const getTemplateFieldName = (field: Field): string | undefined => {
  if (field.type !== 'group') {
    return undefined;
  }

  const templateField = (field.custom as TemplateFieldCustom | undefined)
    ?.templateField;

  return templateField?.marker === TEMPLATE_FIELD_MARKER &&
    typeof templateField.template === 'string'
    ? templateField.template
    : undefined;
};

export const templateField = (props: TemplateFieldConfig): GroupField => {
  const { name, template, ...rest } = props;
  return {
    ...rest,
    name,
    type: 'group',
    custom: {
      templateField: {
        marker: TEMPLATE_FIELD_MARKER,
        template,
      },
    },
    fields: [],
  };
};
