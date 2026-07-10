import type { LabelFunction } from 'payload'

const en = {
  contentTab: 'Content', seoTab: 'SEO', seo: 'SEO', general: 'General', canonical: 'Canonical', robots: 'Robots', openGraph: 'Open Graph', twitter: 'X / Twitter', schema: 'Schema', previews: 'Previews',
  title: 'Title', description: 'Description', focusKeyword: 'Focus keyword', image: 'Image', card: 'Card',
  canonicalMode: 'Canonical mode', canonicalUrl: 'Canonical URL', auto: 'Auto', manual: 'Manual', none: 'None',
  robotsIndex: 'Index directive', robotsFollow: 'Follow directive', index: 'Index', noindex: 'No index', follow: 'Follow', nofollow: 'No follow',
  summary: 'Summary', summaryLargeImage: 'Summary large image',
  schemaType: 'Schema type', schemaOverrides: 'Schema overrides', rawJson: 'Raw JSON override',
  name: 'Name', about: 'About', headline: 'Headline', author: 'Author', datePublished: 'Published date', dateModified: 'Modified date', productDescription: 'Product description', sku: 'SKU', brand: 'Brand', price: 'Price', priceCurrency: 'Price currency', telephone: 'Telephone', address: 'Address', question: 'Question', answer: 'Answer',
  seoSettings: 'SEO settings', siteDefaults: 'Site defaults', siteName: 'Site name', titleTemplate: 'Title template', defaultDescription: 'Default description', socialDefaults: 'Social defaults', defaultOpenGraphImage: 'Default Open Graph image', defaultTwitterCard: 'Default X / Twitter card', defaultRobots: 'Default robots', organizationSchema: 'Organization schema', organizationName: 'Organization name', organizationUrl: 'Organization URL', organizationLogo: 'Organization logo', robotsTxt: 'robots.txt', robotsMode: 'Robots mode', generated: 'Generated', override: 'Override', groups: 'Groups', userAgent: 'User-agent', allow: 'Allow', disallow: 'Disallow', path: 'Path', appendText: 'Append text', overrideText: 'Override text',
  seoRedirect: 'SEO redirect', seoRedirects: 'SEO redirects', source: 'Source', destinationType: 'Destination type', destination: 'Destination', internal: 'Internal', external: 'External', statusCode: 'Status code', permanentRedirect: '301 Permanent', temporaryRedirect: '302 Temporary', enabled: 'Enabled', notes: 'Notes',
  validationAbsoluteHttpUrl: 'Enter an absolute HTTP or HTTPS URL.', validationJson: 'Enter valid JSON.', validationManualCanonical: 'A manual canonical URL is required.', validationInternalPath: 'Enter an internal path beginning with one slash, without an origin, query string, or fragment.', validationRedirectLoop: 'Redirects cannot form a loop.',
  previewAriaLabel: 'SEO previews', previewTitle: 'Page title', previewDescription: 'Add a concise description to preview how this document may appear when shared.', previewImageMissing: 'No image selected', googleResult: 'Google result', openGraphPreview: 'Open Graph · example.com', twitterPreview: 'X card · example.com',
  generatedJson: 'Generated JSON', copy: 'Copy', copied: 'Copied', generatedJsonDescription: 'This reflects the visual schema fields. A raw override takes precedence when saved.', useGeneratedJson: 'Use generated JSON as override', rawJsonDescription: 'Optional. Valid JSON here replaces the generated schema entirely.', clearRawJson: 'Clear raw JSON override',
  schemaOverridesDescription: 'Values configured by your developer are inherited from this document. Leave a field empty to use its mapped value.', schemaOverrideValue: 'Using {path}: {value}. Enter a value only to override it.', yes: 'Yes', no: 'No',
} as const

type AdminText = { [Key in keyof typeof en]: string }

const ru: AdminText = {
  contentTab: 'Содержимое', seoTab: 'SEO', seo: 'SEO', general: 'Основное', canonical: 'Канонический URL', robots: 'Robots', openGraph: 'Open Graph', twitter: 'X / Twitter', schema: 'Schema', previews: 'Предпросмотр',
  title: 'Заголовок', description: 'Описание', focusKeyword: 'Ключевое слово', image: 'Изображение', card: 'Карточка',
  canonicalMode: 'Режим канонического URL', canonicalUrl: 'Канонический URL', auto: 'Автоматически', manual: 'Вручную', none: 'Нет',
  robotsIndex: 'Директива индексации', robotsFollow: 'Директива ссылок', index: 'Индексировать', noindex: 'Не индексировать', follow: 'Переходить по ссылкам', nofollow: 'Не переходить по ссылкам',
  summary: 'Краткая', summaryLargeImage: 'Краткая с большим изображением',
  schemaType: 'Тип Schema', schemaOverrides: 'Переопределения Schema', rawJson: 'Переопределение Raw JSON',
  name: 'Название', about: 'О странице', headline: 'Заголовок', author: 'Автор', datePublished: 'Дата публикации', dateModified: 'Дата изменения', productDescription: 'Описание товара', sku: 'Артикул', brand: 'Бренд', price: 'Цена', priceCurrency: 'Валюта цены', telephone: 'Телефон', address: 'Адрес', question: 'Вопрос', answer: 'Ответ',
  seoSettings: 'Настройки SEO', siteDefaults: 'Настройки сайта', siteName: 'Название сайта', titleTemplate: 'Шаблон заголовка', defaultDescription: 'Описание по умолчанию', socialDefaults: 'Настройки соцсетей', defaultOpenGraphImage: 'Изображение Open Graph по умолчанию', defaultTwitterCard: 'Карточка X / Twitter по умолчанию', defaultRobots: 'Robots по умолчанию', organizationSchema: 'Schema организации', organizationName: 'Название организации', organizationUrl: 'URL организации', organizationLogo: 'Логотип организации', robotsTxt: 'robots.txt', robotsMode: 'Режим robots', generated: 'Сгенерированный', override: 'Переопределение', groups: 'Группы', userAgent: 'User-agent', allow: 'Разрешить', disallow: 'Запретить', path: 'Путь', appendText: 'Добавить текст', overrideText: 'Текст переопределения',
  seoRedirect: 'SEO-перенаправление', seoRedirects: 'SEO-перенаправления', source: 'Источник', destinationType: 'Тип назначения', destination: 'Назначение', internal: 'Внутреннее', external: 'Внешнее', statusCode: 'Код статуса', permanentRedirect: '301 Постоянное', temporaryRedirect: '302 Временное', enabled: 'Включено', notes: 'Заметки',
  validationAbsoluteHttpUrl: 'Введите абсолютный URL HTTP или HTTPS.', validationJson: 'Введите корректный JSON.', validationManualCanonical: 'Требуется канонический URL, заданный вручную.', validationInternalPath: 'Введите внутренний путь, начинающийся с одного слеша, без домена, строки запроса или фрагмента.', validationRedirectLoop: 'Перенаправления не могут образовывать цикл.',
  previewAriaLabel: 'Предпросмотры SEO', previewTitle: 'Заголовок страницы', previewDescription: 'Добавьте краткое описание, чтобы увидеть, как документ может выглядеть при публикации.', previewImageMissing: 'Изображение не выбрано', googleResult: 'Результат Google', openGraphPreview: 'Open Graph · example.com', twitterPreview: 'Карточка X · example.com',
  generatedJson: 'Сгенерированный JSON', copy: 'Копировать', copied: 'Скопировано', generatedJsonDescription: 'Это отражает визуальные поля Schema. При сохранении Raw JSON имеет приоритет.', useGeneratedJson: 'Использовать сгенерированный JSON как переопределение', rawJsonDescription: 'Необязательно. Корректный JSON здесь полностью заменяет сгенерированную Schema.', clearRawJson: 'Очистить переопределение Raw JSON',
  schemaOverridesDescription: 'Значения, настроенные разработчиком, наследуются из этого документа. Оставьте поле пустым, чтобы использовать сопоставленное значение.', schemaOverrideValue: 'Используется {path}: {value}. Введите значение, только чтобы переопределить его.', yes: 'Да', no: 'Нет',
}

const uk: AdminText = {
  contentTab: 'Вміст', seoTab: 'SEO', seo: 'SEO', general: 'Загальне', canonical: 'Канонічний URL', robots: 'Robots', openGraph: 'Open Graph', twitter: 'X / Twitter', schema: 'Schema', previews: 'Попередній перегляд',
  title: 'Заголовок', description: 'Опис', focusKeyword: 'Ключове слово', image: 'Зображення', card: 'Картка',
  canonicalMode: 'Режим канонічного URL', canonicalUrl: 'Канонічний URL', auto: 'Автоматично', manual: 'Вручну', none: 'Немає',
  robotsIndex: 'Директива індексації', robotsFollow: 'Директива посилань', index: 'Індексувати', noindex: 'Не індексувати', follow: 'Переходити за посиланнями', nofollow: 'Не переходити за посиланнями',
  summary: 'Коротка', summaryLargeImage: 'Коротка з великим зображенням',
  schemaType: 'Тип Schema', schemaOverrides: 'Перевизначення Schema', rawJson: 'Перевизначення Raw JSON',
  name: 'Назва', about: 'Про сторінку', headline: 'Заголовок', author: 'Автор', datePublished: 'Дата публікації', dateModified: 'Дата зміни', productDescription: 'Опис товару', sku: 'Артикул', brand: 'Бренд', price: 'Ціна', priceCurrency: 'Валюта ціни', telephone: 'Телефон', address: 'Адреса', question: 'Запитання', answer: 'Відповідь',
  seoSettings: 'Налаштування SEO', siteDefaults: 'Налаштування сайту', siteName: 'Назва сайту', titleTemplate: 'Шаблон заголовка', defaultDescription: 'Опис за замовчуванням', socialDefaults: 'Налаштування соцмереж', defaultOpenGraphImage: 'Зображення Open Graph за замовчуванням', defaultTwitterCard: 'Картка X / Twitter за замовчуванням', defaultRobots: 'Robots за замовчуванням', organizationSchema: 'Schema організації', organizationName: 'Назва організації', organizationUrl: 'URL організації', organizationLogo: 'Логотип організації', robotsTxt: 'robots.txt', robotsMode: 'Режим robots', generated: 'Згенерований', override: 'Перевизначення', groups: 'Групи', userAgent: 'User-agent', allow: 'Дозволити', disallow: 'Заборонити', path: 'Шлях', appendText: 'Додати текст', overrideText: 'Текст перевизначення',
  seoRedirect: 'SEO-перенаправлення', seoRedirects: 'SEO-перенаправлення', source: 'Джерело', destinationType: 'Тип призначення', destination: 'Призначення', internal: 'Внутрішнє', external: 'Зовнішнє', statusCode: 'Код статусу', permanentRedirect: '301 Постійне', temporaryRedirect: '302 Тимчасове', enabled: 'Увімкнено', notes: 'Нотатки',
  validationAbsoluteHttpUrl: 'Введіть абсолютний URL HTTP або HTTPS.', validationJson: 'Введіть коректний JSON.', validationManualCanonical: 'Потрібен канонічний URL, заданий вручну.', validationInternalPath: 'Введіть внутрішній шлях, що починається з одного слеша, без домену, рядка запиту або фрагмента.', validationRedirectLoop: 'Перенаправлення не можуть утворювати цикл.',
  previewAriaLabel: 'Попередні перегляди SEO', previewTitle: 'Заголовок сторінки', previewDescription: 'Додайте стислий опис, щоб побачити, як документ може виглядати під час поширення.', previewImageMissing: 'Зображення не вибрано', googleResult: 'Результат Google', openGraphPreview: 'Open Graph · example.com', twitterPreview: 'Картка X · example.com',
  generatedJson: 'Згенерований JSON', copy: 'Копіювати', copied: 'Скопійовано', generatedJsonDescription: 'Це відображає візуальні поля Schema. Під час збереження Raw JSON має пріоритет.', useGeneratedJson: 'Використати згенерований JSON як перевизначення', rawJsonDescription: 'Необов’язково. Коректний JSON тут повністю замінює згенеровану Schema.', clearRawJson: 'Очистити перевизначення Raw JSON',
  schemaOverridesDescription: 'Значення, налаштовані розробником, успадковуються з цього документа. Залиште поле порожнім, щоб використати зіставлене значення.', schemaOverrideValue: 'Використовується {path}: {value}. Введіть значення, лише щоб перевизначити його.', yes: 'Так', no: 'Ні',
}

/** The single typed catalog for every plugin-owned Payload Admin string. */
export const adminTranslations = { en, ru, uk } satisfies Record<'en' | 'ru' | 'uk', AdminText>

export type AdminLanguage = keyof typeof adminTranslations
export type AdminTextKey = keyof typeof en

export const resolveAdminLanguage = (language?: string): AdminLanguage => {
  const normalized = language?.trim().toLowerCase().split(/[-_]/, 1)[0]
  return normalized === 'ru' || normalized === 'uk' || normalized === 'en' ? normalized : 'en'
}

export const adminText = (key: AdminTextKey, language?: string, variables: Record<string, string> = {}): string =>
  adminTranslations[resolveAdminLanguage(language)][key].replace(/\{(\w+)\}/g, (_, name: string) => variables[name] ?? `{${name}}`)

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
})

/** Lets Payload resolve generated labels using the active Admin interface language. */
export const adminLabel = (key: AdminTextKey): LabelFunction =>
  ({ i18n }: { i18n?: { language?: string } } = {}) => adminText(key, i18n?.language)
