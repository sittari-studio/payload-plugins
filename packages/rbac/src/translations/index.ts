import { en } from './en.js'
import { ru } from './ru.js'
import { uk } from './uk.js'

export const translations = { en, ru, uk }

export type RbacLanguage = keyof typeof translations
export type RbacTranslationKey = keyof typeof en

export const resolveLanguage = (language?: string): RbacLanguage => {
  const normalized = language?.trim().toLowerCase().split(/[-_]/, 1)[0]
  return normalized === 'ru' || normalized === 'uk' ? normalized : 'en'
}

export const translate = (
  key: RbacTranslationKey,
  language?: string,
): string => translations[resolveLanguage(language)][key]

export const localizedText = (
  key: RbacTranslationKey,
): Record<RbacLanguage, string> => ({
  en: en[key],
  ru: ru[key],
  uk: uk[key],
})

export const resolveLocalizedText = (
  value: Record<string, string> | string,
  language?: string,
): string => {
  if (typeof value === 'string') {
    return value
  }

  const resolvedLanguage = resolveLanguage(language)
  return value[resolvedLanguage] ?? value.en ?? Object.values(value)[0] ?? ''
}
