import type { LabelFunction } from 'payload';

import { en } from '../translations/en.js';
import { ru } from '../translations/ru.js';
import { uk } from '../translations/uk.js';

/** The single typed catalog for every plugin-owned Payload Admin string. */
export const adminTranslations = { en, ru, uk };

export type AdminLanguage = keyof typeof adminTranslations;
export type AdminTextKey = keyof typeof en;

export const resolveAdminLanguage = (language?: string): AdminLanguage => {
  const normalized = language?.trim().toLowerCase().split(/[-_]/, 1)[0];
  return normalized === 'ru' || normalized === 'uk' || normalized === 'en'
    ? normalized
    : 'en';
};

export const adminText = (
  key: AdminTextKey,
  language?: string,
  variables: Record<string, string> = {},
): string =>
  adminTranslations[resolveAdminLanguage(language)][key].replace(
    /\{(\w+)\}/g,
    (_, name: string) => variables[name] ?? `{${name}}`,
  );

/**
 * Payload v3 serializes tab-label callbacks with only `{ t }`, omitting i18n.
 * Keep tab labels as language maps so the Tabs client resolves them itself.
 */
export const adminTabLabel = (key: AdminTextKey): Record<string, string> => ({
  en: adminText(key, 'en'),
  'en-GB': adminText(key, 'en-GB'),
  ru: adminText(key, 'ru'),
  'ru-RU': adminText(key, 'ru-RU'),
  uk: adminText(key, 'uk'),
  'uk-UA': adminText(key, 'uk-UA'),
});

/** Lets Payload resolve generated labels using the active Admin interface language. */
export const adminLabel =
  (key: AdminTextKey): LabelFunction =>
  ({ i18n }: { i18n?: { language?: string } } = {}) =>
    adminText(key, i18n?.language);
