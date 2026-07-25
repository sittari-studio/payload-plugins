import { en } from './en.js'
import { ru } from './ru.js'
import { uk } from './uk.js'

export const translations = { en, ru, uk }

export type TemplatesLanguage = keyof typeof translations
export type TemplatesTranslationKey = keyof typeof en

export const localizedText = (key: TemplatesTranslationKey): Record<TemplatesLanguage, string> => ({
  en: en[key],
  ru: ru[key],
  uk: uk[key],
})
