import type { Payload } from 'payload';

import type {
  GetStringsOptions,
  GetTranslationsOptions,
  Strings,
  StringsRuntimeConfig,
  Translator,
} from './types.js';

/**
 * Key under `payload.config.custom` where the plugin stores the slug and
 * scope definitions so helpers can discover custom slugs and defaults.
 */
export const STRINGS_RUNTIME_CONFIG_KEY = '@sittari/payload-strings/config';

export const getStringsRuntimeConfig = (
  payload: Payload,
): StringsRuntimeConfig => {
  const value = payload.config?.custom?.[STRINGS_RUNTIME_CONFIG_KEY];

  if (
    value === null ||
    typeof value !== 'object' ||
    typeof (value as StringsRuntimeConfig).slug !== 'string'
  ) {
    throw new Error(
      'getTranslations requires stringsPlugin to be added to your Payload config.',
    );
  }

  return value as StringsRuntimeConfig;
};

type Localization = NonNullable<Payload['config']>['localization'];
type LocaleEntry = Exclude<Localization, false>['locales'][number];

const localeCodes = (payload: Payload): string[] => {
  const localization = payload.config.localization;

  if (!localization) {
    return [];
  }

  return localization.locales.map(
    (locale: LocaleEntry) => locale.code as string,
  );
};

/**
 * Raw `findGlobal({ locale: 'all' })` response: scopes-first, with each
 * string holding a record keyed by locale code.
 */
type AllLocalesResponse = Record<
  string,
  Record<string, Record<string, unknown>>
>;

/**
 * Loads every configured locale in one query and returns a normalized,
 * locale-first string table. Every configured locale, scope, and key is
 * materialized; missing, empty, and nullish stored values are replaced by
 * the scope's `defaultValue`, or `null` when no default exists.
 * Whitespace-only strings are preserved as valid values.
 *
 * ```ts
 * const strings = await getStrings({ payload });
 * strings.en.general.cancelButton; // stored value | defaultValue | null
 * ```
 */
export const getStrings = async ({
  payload,
}: GetStringsOptions): Promise<Strings> => {
  const { scopes, slug } = getStringsRuntimeConfig(payload);

  const response = await payload.findGlobal({
    slug,
    locale: 'all',
    fallbackLocale: false,
  });

  const allLocales: AllLocalesResponse =
    (response ?? {}) as AllLocalesResponse;

  const strings: Strings = {};

  for (const code of localeCodes(payload)) {
    const scoped: Record<string, Record<string, string | null>> = {};

    for (const [scopeName, scope] of Object.entries(scopes)) {
      const values: Record<string, string | null> = {};

      for (const [stringKey, definition] of Object.entries(
        scope.strings ?? {},
      )) {
        const raw = allLocales[scopeName]?.[stringKey];
        const stored =
          typeof raw === 'object' && raw !== null
            ? (raw as Record<string, unknown>)[code]
            : undefined;

        values[stringKey] =
          typeof stored === 'string' && stored.length > 0
            ? stored
            : (definition.defaultValue ?? null);
      }

      scoped[scopeName] = values;
    }

    strings[code] = scoped;
  }

  return strings;
};

/**
 * Builds the existing synchronous {@link Translator} from a normalized
 * locale-first table returned by {@link getStrings}. Dot-separated keys
 * resolve through scopes; per-call locales override the default; unknown
 * scopes, keys, or locales resolve to `null`.
 */
export const createTranslator = (
  strings: Strings,
  locale?: string,
): Translator =>
  (key, requested) => {
    const code = requested ?? locale;

    if (!code) {
      return null;
    }

    const [scopeName, ...rest] = key.split('.');
    const stringKey = rest.join('.');

    const stored = strings[code]?.[scopeName]?.[stringKey];

    return typeof stored === 'string' ? stored : null;
  };

/**
 * Loads every configured locale once and returns a synchronous translator.
 *
 * ```ts
 * const t = await getTranslations({ payload, locale: 'en' });
 * t('general.cancelButton');
 * t('general.cancelButton', 'fr');
 * ```
 */
export const getTranslations = async ({
  payload,
  locale,
}: GetTranslationsOptions): Promise<Translator> => {
  const strings = await getStrings({ payload });

  const localization = payload.config.localization;
  const defaultLocale = locale ??
    (localization ? localization.defaultLocale : undefined);

  return createTranslator(strings, defaultLocale);
};
