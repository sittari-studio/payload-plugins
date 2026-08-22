import type { JsonObject, JsonValue, SeoJsonPatchOperation } from './types.js';

export type SchemaValueType =
  | 'array'
  | 'boolean'
  | 'null'
  | 'number'
  | 'object'
  | 'string';

export const cloneJson = <T extends JsonValue>(value: T): T =>
  structuredClone(value);

export const schemaValueType = (value: JsonValue): SchemaValueType =>
  value === null
    ? 'null'
    : Array.isArray(value)
      ? 'array'
      : (typeof value as Exclude<SchemaValueType, 'array' | 'null'>);

export const createSchemaValue = (type: SchemaValueType): JsonValue => {
  if (type === 'array') return [];
  if (type === 'boolean') return false;
  if (type === 'null') return null;
  if (type === 'number') return 0;
  if (type === 'object') return {};
  return '';
};

export const uniquePropertyName = (
  object: JsonObject,
  preferred = 'property',
): string => {
  if (!Object.hasOwn(object, preferred)) return preferred;
  let suffix = 2;
  while (Object.hasOwn(object, `${preferred}${suffix}`)) suffix += 1;
  return `${preferred}${suffix}`;
};

export const renameSchemaProperty = (
  object: JsonObject,
  from: string,
  to: string,
): JsonObject => {
  const name = to.trim();
  if (!name || name === from || Object.hasOwn(object, name)) return object;
  return Object.fromEntries(
    Object.entries(object).map(([key, value]) =>
      key === from ? [name, value] : [key, value],
    ),
  );
};

export const reorderSchemaEntry = (
  container: JsonObject | JsonValue[],
  from: number,
  to: number,
): JsonObject | JsonValue[] => {
  const length = Array.isArray(container)
    ? container.length
    : Object.keys(container).length;
  if (from < 0 || to < 0 || from >= length || to >= length || from === to)
    return container;
  if (Array.isArray(container)) {
    const copy = [...container];
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item);
    return copy;
  }
  const entries = Object.entries(container);
  const [entry] = entries.splice(from, 1);
  entries.splice(to, 0, entry);
  return Object.fromEntries(entries);
};

export const duplicateSchemaEntry = (
  container: JsonObject | JsonValue[],
  index: number,
): JsonObject | JsonValue[] => {
  if (Array.isArray(container)) {
    if (index < 0 || index >= container.length) return container;
    return [
      ...container.slice(0, index + 1),
      cloneJson(container[index]),
      ...container.slice(index + 1),
    ];
  }
  const entries = Object.entries(container);
  const entry = entries[index];
  if (!entry) return container;
  const [key, value] = entry;
  const copyName = uniquePropertyName(container, `${key}Copy`);
  entries.splice(index + 1, 0, [copyName, cloneJson(value)]);
  return Object.fromEntries(entries);
};

export const removeSchemaEntry = (
  container: JsonObject | JsonValue[],
  index: number,
): JsonObject | JsonValue[] => {
  if (Array.isArray(container))
    return container.filter((_, itemIndex) => itemIndex !== index);
  return Object.fromEntries(
    Object.entries(container).filter((_, itemIndex) => itemIndex !== index),
  );
};

export const setSchemaValueAtPath = (
  root: JsonValue,
  path: Array<number | string>,
  value: JsonValue,
): JsonValue => {
  if (!path.length) return value;
  const [head, ...tail] = path;
  if (Array.isArray(root) && typeof head === 'number') {
    const copy = [...root];
    copy[head] = setSchemaValueAtPath(copy[head] ?? '', tail, value);
    return copy;
  }
  if (
    root !== null &&
    typeof root === 'object' &&
    !Array.isArray(root) &&
    typeof head === 'string'
  ) {
    return {
      ...root,
      [head]: setSchemaValueAtPath(root[head] ?? '', tail, value),
    };
  }
  return root;
};

export const insertVariableAtCaret = (
  value: string,
  variable: string,
  selectionStart: number,
  selectionEnd = selectionStart,
): { caret: number; value: string } => {
  const before = value.slice(0, selectionStart);
  const token = before.match(/\$[A-Za-z0-9_.]*$/);
  const start = token ? selectionStart - token[0].length : selectionStart;
  const inserted = variable.startsWith('$') ? variable : `$${variable}`;
  const next = `${value.slice(0, start)}${inserted}${value.slice(selectionEnd)}`;
  return { caret: start + inserted.length, value: next };
};

export const escapeJsonPointerSegment = (segment: string): string =>
  segment.replace(/~/g, '~0').replace(/\//g, '~1');

const equal = (
  left: JsonValue | undefined,
  right: JsonValue | undefined,
): boolean => JSON.stringify(left) === JSON.stringify(right);

export const hasSameSchemaStructure = (
  left: JsonValue,
  right: JsonValue,
): boolean => {
  if (schemaValueType(left) !== schemaValueType(right)) return false;
  if (Array.isArray(left) && Array.isArray(right))
    return (
      left.length === right.length &&
      left.every((value, index) => hasSameSchemaStructure(value, right[index]))
    );
  if (
    left !== null &&
    right !== null &&
    typeof left === 'object' &&
    typeof right === 'object' &&
    !Array.isArray(left) &&
    !Array.isArray(right)
  ) {
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return (
      equal(
        leftKeys as unknown as JsonValue,
        rightKeys as unknown as JsonValue,
      ) &&
      leftKeys.every((key) => hasSameSchemaStructure(left[key], right[key]))
    );
  }
  return true;
};

/** Deterministically diffs effective schema objects. Arrays are replaced as a unit. */
export const diffEffectiveSchema = (
  base: JsonObject,
  next: JsonObject,
  options: { scalarValuesOnly?: boolean } = {},
): SeoJsonPatchOperation[] => {
  const operations: SeoJsonPatchOperation[] = [];
  const visit = (
    previous: JsonValue,
    current: JsonValue,
    path: string,
  ): void => {
    if (equal(previous, current)) return;
    const previousType = schemaValueType(previous);
    const currentType = schemaValueType(current);
    if (previousType !== currentType || previousType === 'array') {
      if (!options.scalarValuesOnly)
        operations.push({ op: 'replace', path, value: cloneJson(current) });
      return;
    }
    if (previousType !== 'object') {
      operations.push({ op: 'replace', path, value: cloneJson(current) });
      return;
    }
    const previousObject = previous as JsonObject;
    const currentObject = current as JsonObject;
    const previousKeys = Object.keys(previousObject).sort();
    const currentKeys = Object.keys(currentObject).sort();
    if (!options.scalarValuesOnly) {
      for (const key of previousKeys)
        if (!Object.hasOwn(currentObject, key))
          operations.push({
            op: 'remove',
            path: `${path}/${escapeJsonPointerSegment(key)}`,
          });
    }
    for (const key of currentKeys) {
      const childPath = `${path}/${escapeJsonPointerSegment(key)}`;
      if (!Object.hasOwn(previousObject, key)) {
        if (!options.scalarValuesOnly)
          operations.push({
            op: 'add',
            path: childPath,
            value: cloneJson(currentObject[key]),
          });
      } else visit(previousObject[key], currentObject[key], childPath);
    }
  };
  visit(base, next, '');
  return operations;
};

export type SchemaImportResult =
  | { ok: false; reason: 'invalid' | 'root' }
  | { ok: true; schema: JsonObject; hasManagedContext: boolean };

export const parseSchemaImport = (raw: string): SchemaImportResult => {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return { ok: false, reason: 'root' };
    const containsContext = (value: JsonValue): boolean =>
      Array.isArray(value)
        ? value.some(containsContext)
        : value !== null && typeof value === 'object'
          ? Object.entries(value).some(
              ([key, child]) => key === '@context' || containsContext(child),
            )
          : false;
    return {
      ok: true,
      schema: parsed as JsonObject,
      hasManagedContext: containsContext(parsed as JsonObject),
    };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
};

export const removeManagedContext = (schema: JsonObject): JsonObject => {
  const visit = (value: JsonValue): JsonValue => {
    if (Array.isArray(value)) return value.map(visit);
    if (value !== null && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value).flatMap(([key, child]) =>
          key === '@context' ? [] : [[key, visit(child)]],
        ),
      );
    return value;
  };
  return visit(schema) as JsonObject;
};
