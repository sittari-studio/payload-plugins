import { en } from './en.js'
import { ru } from './ru.js'
import { uk } from './uk.js'

export const translations = { en, ru, uk }

export type LinkFieldLanguage = keyof typeof translations
export type LinkFieldTranslationKey = keyof typeof en

export const resolveLanguage = (language?: string): LinkFieldLanguage => {
  const normalized = language?.trim().toLowerCase().split(/[-_]/, 1)[0]
  return normalized === 'ru' || normalized === 'uk' ? normalized : 'en'
}

export const translate = (
  key: LinkFieldTranslationKey,
  language?: string,
): string => translations[resolveLanguage(language)][key]

export const localizedText = (
  key: LinkFieldTranslationKey,
): Record<LinkFieldLanguage, string> => ({
  en: en[key],
  ru: ru[key],
  uk: uk[key],
})
