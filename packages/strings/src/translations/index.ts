import { en } from './en.js';
import { ru } from './ru.js';
import { uk } from './uk.js';

export const translations = { en, ru, uk };

export type StringsLanguage = keyof typeof translations;
export type StringsTranslationKey = keyof typeof en;

export const localizedText = (
  key: StringsTranslationKey,
): Record<StringsLanguage, string> => ({
  en: en[key],
  ru: ru[key],
  uk: uk[key],
});
