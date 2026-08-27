import type { GlobalConfig, Payload } from 'payload';

/**
 * A plain string or a record keyed by Payload locale code.
 */
export type LocalizedText = string | Record<string, string>;

export type StringsString = {
  /**
   * Shown as the admin placeholder while the string is empty, in every locale.
   */
  defaultValue?: string;
  /** Optional admin description, localized when keyed by locale code. */
  description?: LocalizedText;
};

export type StringsScope = {
  /** Admin tab label, localized when keyed by locale code. */
  labels: LocalizedText;
  /** String definitions keyed by the generated field name. */
  strings: Record<string, StringsString>;
};

export type StringsScopes = Record<string, StringsScope>;

export type StringsPluginConfig = {
  /** Set to `false` to return the incoming Payload config unchanged. */
  enabled?: boolean;
  /** Slug of the generated global. */
  slug?: string;
  /** Scope definitions keyed by the generated tab and API property name. */
  scopes?: StringsScopes;
  /** Extend or replace the final global configuration. Applied last. */
  overrides?: (defaultGlobal: GlobalConfig) => GlobalConfig;
};

/** Internal plugin metadata stored on the Payload config for helper discovery. */
export type StringsRuntimeConfig = {
  slug: string;
  scopes: StringsScopes;
};

/**
 * Normalized locale-first string table returned by {@link getStrings},
 * keyed by locale code, then scope name, then string key. Missing, nullish,
 * and empty stored values are replaced with the configured `defaultValue`,
 * or `null` when no default exists.
 */
export type Strings = Record<
  string,
  Record<string, Record<string, string | null>>
>;

export type GetStringsOptions = {
  payload: Payload;
};

/**
 * Synchronous translator returned by {@link getTranslations} and
 * {@link createTranslator}. Returns the stored translation when non-empty,
 * otherwise the configured `defaultValue`, or `null` when neither exists.
 */
export type Translator = {
  (key: string, locale?: string): string | null;
};

export type GetTranslationsOptions = {
  payload: Payload;
  /** Locale used when a call does not pass an explicit one. */
  locale?: string;
};
