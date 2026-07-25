import { en } from './en.js'
import { ru } from './ru.js'
import { uk } from './uk.js'

export const translations = { en, ru, uk }

export type SlugFieldLanguage = keyof typeof translations
export type SlugFieldTranslationKey = keyof typeof en

export const localizedText = (key: SlugFieldTranslationKey): Record<SlugFieldLanguage, string> => ({
  en: en[key],
  ru: ru[key],
  uk: uk[key],
})
