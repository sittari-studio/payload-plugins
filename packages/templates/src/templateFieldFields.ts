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
  let cloned: Field = {
    ...field,
    ...('name' in field && field.type !== 'ui' ? { required: false } : {}),
  };

  if ('fields' in cloned && Array.isArray(cloned.fields)) {
    cloned = {
      ...cloned,
      fields: cloneFields(cloned.fields, blocks, resolving),
    };
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

type MergeOptions = {
  fallbackLocale?: unknown;
  flattenLocalizedValues?: boolean;
  locale?: string;
};

const hasOwn = (value: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const getFallbackLocales = (fallbackLocale: unknown): string[] => {
  if (typeof fallbackLocale === 'string') {
    return [fallbackLocale];
  }

  return Array.isArray(fallbackLocale)
    ? fallbackLocale.filter(
        (locale): locale is string => typeof locale === 'string',
      )
    : [];
};

const getLocalizedTemplateValue = (
  templateValue: unknown,
  { fallbackLocale, locale }: MergeOptions,
): unknown => {
  if (!locale || !isPlainObject(templateValue)) {
    return templateValue;
  }

  const localizedValue = hasOwn(templateValue, locale)
    ? templateValue[locale]
    : undefined;
  if (!isEmptyValue(localizedValue)) {
    return localizedValue;
  }

  for (const fallback of getFallbackLocales(fallbackLocale)) {
    const fallbackValue = hasOwn(templateValue, fallback)
      ? templateValue[fallback]
      : undefined;
    if (!isEmptyValue(fallbackValue)) {
      return fallbackValue;
    }
  }

  return hasOwn(templateValue, locale) ? localizedValue : undefined;
};

const mergeFieldValue = (
  field: Field,
  localValue: unknown,
  templateValue: unknown,
  options: MergeOptions,
): unknown => {
  if (field.type === 'group') {
    return mergeStructuralValue(
      field.fields,
      localValue,
      templateValue,
      options,
    );
  }

  return isEmptyValue(localValue) && templateValue !== undefined
    ? cloneValue(templateValue)
    : localValue;
};

const mergeLocalizedFieldValue = (
  field: Field,
  localValue: unknown,
  templateValue: unknown,
  options: MergeOptions,
): unknown => {
  if (options.flattenLocalizedValues && isPlainObject(localValue)) {
    localValue = getLocalizedTemplateValue(localValue, options);
  }

  if (isEmptyValue(localValue)) {
    const resolvedTemplateValue =
      isPlainObject(localValue) && Object.keys(localValue).length > 0
        ? templateValue
        : getLocalizedTemplateValue(templateValue, options);

    return resolvedTemplateValue === undefined
      ? localValue
      : mergeFieldValue(field, localValue, resolvedTemplateValue, options);
  }

  if (!isPlainObject(localValue) || !isPlainObject(templateValue)) {
    return mergeFieldValue(field, localValue, templateValue, options);
  }

  const result = { ...localValue };
  for (const [locale, localizedTemplateValue] of Object.entries(
    templateValue,
  )) {
    result[locale] = mergeFieldValue(
      field,
      result[locale],
      localizedTemplateValue,
      options,
    );
  }
  return result;
};

const mergeNamedFields = (
  fields: Field[],
  localValue: unknown,
  templateValue: unknown,
  options: MergeOptions,
  preserveTemplateFields = false,
): Record<string, unknown> => {
  const localData = isPlainObject(localValue) ? localValue : {};
  const templateData = isPlainObject(templateValue) ? templateValue : {};
  let result: Record<string, unknown> = preserveTemplateFields
    ? (cloneValue(templateData) as Record<string, unknown>)
    : { ...localData };

  for (const field of fields) {
    if (field.type === 'row' || field.type === 'collapsible') {
      result = mergeNamedFields(
        field.fields,
        result,
        templateData,
        options,
        preserveTemplateFields,
      );
      continue;
    }

    if (field.type === 'tabs') {
      for (const tab of field.tabs) {
        if ('name' in tab && typeof tab.name === 'string') {
          result[tab.name] = mergeStructuralValue(
            tab.fields,
            result[tab.name],
            templateData[tab.name],
            options,
          );
        } else {
          result = mergeNamedFields(
            tab.fields,
            result,
            templateData,
            options,
            preserveTemplateFields,
          );
        }
      }
      continue;
    }

    if (field.type === 'group' && !('name' in field)) {
      result = mergeNamedFields(
        field.fields,
        result,
        templateData,
        options,
        preserveTemplateFields,
      );
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
        options,
      );
      continue;
    }

    result[field.name] = mergeFieldValue(
      field,
      localFieldValue,
      templateFieldValue,
      options,
    );
  }

  return result;
};

const mergeStructuralValue = (
  fields: Field[],
  localValue: unknown,
  templateValue: unknown,
  options: MergeOptions,
): unknown => {
  if (isEmptyValue(localValue)) {
    return templateValue === undefined
      ? localValue
      : isPlainObject(templateValue)
        ? mergeNamedFields(fields, {}, templateValue, options, true)
        : cloneValue(templateValue);
  }

  if (!isPlainObject(localValue) || !isPlainObject(templateValue)) {
    return localValue;
  }

  return mergeNamedFields(fields, localValue, templateValue, options);
};

export const mergeTemplateValues = (
  fields: Field[],
  localValue: unknown,
  templateValue: unknown,
  options: MergeOptions = {},
): unknown => mergeStructuralValue(fields, localValue, templateValue, options);
