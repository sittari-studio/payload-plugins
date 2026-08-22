import { en } from './en.js';
import { ru } from './ru.js';
import { uk } from './uk.js';

export const translations = { en, ru, uk };

export type PagesLanguage = keyof typeof translations;
export type PagesTranslationKey = keyof typeof en;

export const localizedText = (
  key: PagesTranslationKey,
): Record<PagesLanguage, string> => ({
  en: en[key],
  ru: ru[key],
  uk: uk[key],
});
