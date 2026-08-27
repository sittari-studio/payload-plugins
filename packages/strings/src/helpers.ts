import type { Payload } from 'payload';

import type {
  GetTranslationsOptions,
  StringsRuntimeConfig,
  Translator,
} from './types.js';

/**
 * Key under `payload.config.custom` where the plugin stores the slug and
 * scope definitions so helpers can discover custom slugs and defaults.
 */
export const STRINGS_RUNTIME_CONFIG_KEY = '@sittari/payload-strings/config';

type ScopedStrings = Record<string, Record<string, unknown>>;

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

const storedValue = (
  values: Map<string, ScopedStrings>,
  scope: string,
  key: string,
  locale: string | undefined,
): unknown => (locale ? values.get(locale)?.[scope]?.[key] : undefined);

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
  const { scopes, slug } = getStringsRuntimeConfig(payload);

  const values = new Map<string, ScopedStrings>(
    await Promise.all(
      localeCodes(payload).map(
        async (code): Promise<[string, ScopedStrings]> => [
          code,
          ((await payload.findGlobal({
            slug,
            locale: code,
            fallbackLocale: false,
          })) ?? {}) as ScopedStrings,
        ],
      ),
    ),
  );

  return (key, requested) => {
    const [scopeName, ...rest] = key.split('.');
    const stringKey = rest.join('.');
    const localization = payload.config.localization;
    const code =
      requested ??
      locale ??
      (localization ? localization.defaultLocale : locale);

    const stored = storedValue(values, scopeName, stringKey, code);
    if (typeof stored === 'string' && stored.length > 0) {
      return stored;
    }

    const defaultValue =
      scopes?.[scopeName]?.strings?.[stringKey]?.defaultValue;

    return defaultValue ?? null;
  };
};
