import type { Block, Field, Tab } from 'payload';

type BlockRegistry = ReadonlyMap<string, Block>;

const cloneBlock = (
  block: Block,
  blocks: BlockRegistry,
  resolving: ReadonlySet<string>,
): Block => {
  const nestedResolving = new Set(resolving).add(block.slug);
  return {
    ...block,
    fields: cloneFields(block.fields, blocks, nestedResolving),
  };
};

const cloneTab = (
  tab: Tab,
  blocks: BlockRegistry,
  resolving: ReadonlySet<string>,
): Tab => ({
  ...tab,
  fields: cloneFields(tab.fields, blocks, resolving),
});

const cloneField = (
  field: Field,
  blocks: BlockRegistry,
  resolving: ReadonlySet<string>,
): Field => {
  let cloned = {
    ...field,
    ...('name' in field && field.type !== 'ui' ? { required: false } : {}),
  } as Field;

  if ('fields' in cloned && Array.isArray(cloned.fields)) {
    cloned = {
      ...cloned,
      fields: cloneFields(cloned.fields, blocks, resolving),
    } as Field;
  }

  if (cloned.type === 'tabs') {
    cloned = {
      ...cloned,
      tabs: cloned.tabs.map((tab) => cloneTab(tab, blocks, resolving)),
    };
  }

  if (cloned.type === 'blocks') {
    cloned = {
      ...cloned,
      blocks: cloned.blocks.map((block) =>
        cloneBlock(block, blocks, resolving),
      ),
      blockReferences: cloned.blockReferences?.map((block) =>
        typeof block === 'string'
          ? blocks.has(block) && !resolving.has(block)
            ? cloneBlock(blocks.get(block)!, blocks, resolving)
            : block
          : cloneBlock(block, blocks, resolving),
      ),
    };
  }

  return cloned;
};

const cloneFields = (
  fields: Field[],
  blocks: BlockRegistry,
  resolving: ReadonlySet<string>,
): Field[] => fields.map((field) => cloneField(field, blocks, resolving));

export const makeFieldsOptional = (
  fields: Field[],
  reusableBlocks: Block[] = [],
): Field[] =>
  cloneFields(
    fields,
    new Map(reusableBlocks.map((block) => [block.slug, block])),
    new Set(),
  );

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const cloneValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, childValue]) => [
        key,
        cloneValue(childValue),
      ]),
    );
  }

  return value;
};

const isEmptyValue = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && value.length === 0) ||
  (isPlainObject(value) && Object.keys(value).length === 0);

const mergeFieldValue = (
  field: Field,
  localValue: unknown,
  templateValue: unknown,
): unknown => {
  if (field.type === 'group') {
    return mergeStructuralValue(field.fields, localValue, templateValue);
  }

  return isEmptyValue(localValue) && templateValue !== undefined
    ? cloneValue(templateValue)
    : localValue;
};

const mergeLocalizedFieldValue = (
  field: Field,
  localValue: unknown,
  templateValue: unknown,
): unknown => {
  if (isEmptyValue(localValue)) {
    return templateValue === undefined ? localValue : cloneValue(templateValue);
  }

  if (!isPlainObject(localValue) || !isPlainObject(templateValue)) {
    return mergeFieldValue(field, localValue, templateValue);
  }

  const result = { ...localValue };
  for (const [locale, localizedTemplateValue] of Object.entries(
    templateValue,
  )) {
    result[locale] = mergeFieldValue(
      field,
      result[locale],
      localizedTemplateValue,
    );
  }
  return result;
};

const mergeNamedFields = (
  fields: Field[],
  localValue: unknown,
  templateValue: unknown,
): Record<string, unknown> => {
  const localData = isPlainObject(localValue) ? localValue : {};
  const templateData = isPlainObject(templateValue) ? templateValue : {};
  let result: Record<string, unknown> = { ...localData };

  for (const field of fields) {
    if (field.type === 'row' || field.type === 'collapsible') {
      result = mergeNamedFields(field.fields, result, templateData);
      continue;
    }

    if (field.type === 'tabs') {
      for (const tab of field.tabs) {
        if ('name' in tab && typeof tab.name === 'string') {
          result[tab.name] = mergeStructuralValue(
            tab.fields,
            result[tab.name],
            templateData[tab.name],
          );
        } else {
          result = mergeNamedFields(tab.fields, result, templateData);
        }
      }
      continue;
    }

    if (field.type === 'group' && !('name' in field)) {
      result = mergeNamedFields(field.fields, result, templateData);
      continue;
    }

    if (!('name' in field)) {
      continue;
    }

    const localFieldValue = result[field.name];
    const templateFieldValue = templateData[field.name];

    if ('localized' in field && field.localized) {
      result[field.name] = mergeLocalizedFieldValue(
        field,
        localFieldValue,
        templateFieldValue,
      );
      continue;
    }

    result[field.name] = mergeFieldValue(
      field,
      localFieldValue,
      templateFieldValue,
    );
  }

  return result;
};

const mergeStructuralValue = (
  fields: Field[],
  localValue: unknown,
  templateValue: unknown,
): unknown => {
  if (isEmptyValue(localValue)) {
    return templateValue === undefined ? localValue : cloneValue(templateValue);
  }

  if (!isPlainObject(localValue) || !isPlainObject(templateValue)) {
    return localValue;
  }

  return mergeNamedFields(fields, localValue, templateValue);
};

export const mergeTemplateValues = (
  fields: Field[],
  localValue: unknown,
  templateValue: unknown,
): unknown => mergeStructuralValue(fields, localValue, templateValue);
