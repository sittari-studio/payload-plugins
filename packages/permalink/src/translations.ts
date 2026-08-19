export const pathLabel = {
  en: 'Path',
  ru: 'Путь',
  uk: 'Шлях',
}

type SupportedLanguage = 'en' | 'ru' | 'uk'

const validationMessages: Record<
  string,
  Record<SupportedLanguage, string>
> = {
  'A slug is required to build the permalink.': {
    en: 'A slug is required to build the permalink.',
    ru: 'Для создания постоянной ссылки требуется slug.',
    uk: 'Для створення постійного посилання потрібен slug.',
  },
  'The parent document must have a permalink before this document can be routed.': {
    en: 'The parent document must have a permalink before this document can be routed.',
    ru: 'У родительского документа должна быть постоянная ссылка, прежде чем можно будет создать адрес этого документа.',
    uk: 'Батьківський документ повинен мати постійне посилання, перш ніж можна буде створити адресу цього документа.',
  },
  'This permalink is already in use.': {
    en: 'This permalink is already in use.',
    ru: 'Эта постоянная ссылка уже используется.',
    uk: 'Це постійне посилання вже використовується.',
  },
  'Path must be a non-empty string.': {
    en: 'Path must be a non-empty string.',
    ru: 'Путь должен быть непустой строкой.',
    uk: 'Шлях має бути непорожнім рядком.',
  },
  'Path must begin with "/".': {
    en: 'Path must begin with "/".',
    ru: 'Путь должен начинаться с "/".',
    uk: 'Шлях має починатися з "/".',
  },
  'Path cannot use a protocol-relative prefix.': {
    en: 'Path cannot use a protocol-relative prefix.',
    ru: 'Путь не может использовать протокол-независимый префикс.',
    uk: 'Шлях не може використовувати протокол-незалежний префікс.',
  },
  'Path cannot contain a query string or fragment.': {
    en: 'Path cannot contain a query string or fragment.',
    ru: 'Путь не может содержать строку запроса или фрагмент.',
    uk: 'Шлях не може містити рядок запиту або фрагмент.',
  },
  'Path cannot contain backslashes.': {
    en: 'Path cannot contain backslashes.',
    ru: 'Путь не может содержать обратные косые черты.',
    uk: 'Шлях не може містити зворотні косі риски.',
  },
  'Path cannot contain control characters.': {
    en: 'Path cannot contain control characters.',
    ru: 'Путь не может содержать управляющие символы.',
    uk: 'Шлях не може містити керівні символи.',
  },
  'Path cannot contain a URI scheme.': {
    en: 'Path cannot contain a URI scheme.',
    ru: 'Путь не может содержать схему URI.',
    uk: 'Шлях не може містити схему URI.',
  },
}

const resolveLanguage = (language?: string): SupportedLanguage => {
  const code = language?.split('-')[0]
  return code === 'ru' || code === 'uk' ? code : 'en'
}

export const translatePathValidationMessage = (
  message: string,
  language?: string,
): string => validationMessages[message]?.[resolveLanguage(language)] ?? message
