import type { FormState } from 'payload';

export type NestedArrayOptions = Record<
  string,
  { nestedArrays?: NestedArrayOptions }
>;

const fieldState = (value: unknown) => ({
  initialValue: value,
  passesCondition: true,
  valid: true,
  value,
});

const generatedRowID = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `seo-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Convert one data row into the relative, flattened state expected by Payload's row actions. */
export const payloadArrayRowState = (
  row: Record<string, unknown>,
  nestedArrays: NestedArrayOptions = {},
): FormState => {
  const state: FormState = {};
  const rowID = typeof row.id === 'string' ? row.id : generatedRowID();

  for (const [name, value] of Object.entries({ ...row, id: rowID })) {
    const nested = nestedArrays[name];
    if (!nested || !Array.isArray(value)) {
      state[name] = fieldState(value);
      continue;
    }

    const rows = value.map((item) => {
      const nestedRow =
        item && typeof item === 'object' && !Array.isArray(item)
          ? (item as Record<string, unknown>)
          : {};
      const id =
        typeof nestedRow.id === 'string' ? nestedRow.id : generatedRowID();
      return { id };
    });
    state[name] = {
      ...fieldState(value.length),
      disableFormData: value.length > 0,
      rows,
    };
    value.forEach((item, index) => {
      const nestedRow =
        item && typeof item === 'object' && !Array.isArray(item)
          ? (item as Record<string, unknown>)
          : {};
      const nestedState = payloadArrayRowState(
        { ...nestedRow, id: rows[index]?.id },
        nested.nestedArrays,
      );
      for (const [childPath, childState] of Object.entries(nestedState)) {
        state[`${name}.${index}.${childPath}`] = childState;
      }
    });
  }

  return state;
};
