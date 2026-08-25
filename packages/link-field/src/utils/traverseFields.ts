import type { Block, Field, Tab } from 'payload';

export type FieldTransformer = (field: Field) => Field;

const hasFields = (field: Field): field is Field & { fields: Field[] } =>
  'fields' in field && Array.isArray(field.fields);

const transformTab = (tab: Tab, transformer: FieldTransformer): Tab => ({
  ...tab,
  fields: tab.fields.map((field) => traverseField(field, transformer)),
});

const transformBlock = (
  block: Block,
  transformer: FieldTransformer,
): Block => ({
  ...block,
  fields: block.fields.map((field) => traverseField(field, transformer)),
});

export const traverseField = (
  field: Field,
  transformer: FieldTransformer,
): Field => {
  let nextField = field;

  if (hasFields(nextField)) {
    const transformedField = {
      ...nextField,
      fields: nextField.fields.map((childField) =>
        traverseField(childField, transformer),
      ),
    } as unknown as Field;
    nextField = transformedField;
  }

  if (nextField.type === 'tabs') {
    nextField = {
      ...nextField,
      tabs: nextField.tabs.map((tab) => transformTab(tab, transformer)),
    };
  }

  if (nextField.type === 'blocks') {
    nextField = {
      ...nextField,
      blocks: nextField.blocks.map((block) =>
        typeof block === 'string' ? block : transformBlock(block, transformer),
      ),
    };
  }

  return transformer(nextField);
};

export const traverseFields = (
  fields: Field[] | undefined,
  transformer: FieldTransformer,
): Field[] | undefined =>
  fields?.map((field) => traverseField(field, transformer));
