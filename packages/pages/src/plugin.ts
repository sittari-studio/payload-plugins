import type { CollectionConfig, Config, Field } from 'payload'
import { createSlugField } from '@sittari/payload-slug-field'

import type { PagesPluginConfig, PageTypes } from './types.js'

const createDefaultPageTypes = (blockSlugs: string[]): PageTypes => ({
  standardContent: {
    label: {
      en: 'Standard Content',
      ru: 'Стандартный контент',
      uk: 'Стандартний контент'
    },
    fields: [
      {
        name: 'content',
        label: {
          "en": 'Content',
          "ru": 'Контент',
          "uk": 'Контент'
        },
        type: 'richText',
        localized: true,
      },
    ],
  },
  flexible: {
    label: {
      en: 'Flexible',
      ru: 'Конструктор',
      uk: 'Конструктор'
    },
    fields: [
      {
        name: 'blocks',
        type: 'blocks',
        label: {
          "en": 'Blocks',
          "ru": 'Блоки',
          "uk": 'Блоки'
        },
        labels: {
          singular: {
            "en": 'Block',
            "ru": 'Блок',
            "uk": 'Блок'
          },
          plural: {
            "en": 'Blocks',
            "ru": 'Блоки',
            "uk": 'Блоки'
          }
        },
        blockReferences: blockSlugs,
        blocks: [],
      },
    ],
  },
})

const createDefaultSlugField = () => createSlugField({
  instruction: {
    en: 'For the home page, set the slug to "home".',
    ru: 'Для главной страницы установите слаг "home".',
    uk: 'Для головної сторінки встановіть слаг "home".',
  },
})

const createPageTypeFields = (pageTypes: PageTypes): Field[] =>
  Object.entries(pageTypes).map(([name, pageType]) => ({
    name,
    type: 'group',
    label: false,
    fields: pageType.fields,

    admin: {
      hideGutter: true,
      condition: (_, siblingData) => siblingData?.pageType === name,
    },
  }))

const createPagesCollection = (pluginConfig: PagesPluginConfig): CollectionConfig => {
  const defaultPageTypes = createDefaultPageTypes(pluginConfig.blockSlugs ?? [])
  const pageTypes = pluginConfig.pageTypes?.({ defaultPageTypes }) ?? defaultPageTypes

  const defaultSlugField = createDefaultSlugField()
  const slugField = pluginConfig.slugField?.({ defaultSlugField }) ?? defaultSlugField

  const defaultFields: Field[] = [
    {
      name: 'title',
      type: 'text',
      label: {
        en: 'Title',
        ru: 'Заголовок',
        uk: 'Заголовок'
      },
      required: true,
      localized: pluginConfig?.localizeTitle ?? true,
    },
    slugField,
    {
      name: 'pageType',
      type: 'select',
      label: {
        en: 'Page Type',
        ru: 'Тип страницы',
        uk: 'Тип сторінки'
      },
      required: true,
      defaultValue: Object.keys(pageTypes)[0],
      options: Object.entries(pageTypes).map(([value, pageType]) => ({
        label: pageType.label,
        value,
      })),
    },
    ...createPageTypeFields(pageTypes),
  ]

  const config: CollectionConfig = {
    slug: 'pages',
    admin: {
      useAsTitle: 'title',
    },
    labels: {
      singular: {
        en: 'Page',
        ru: 'Страница',
        uk: 'Сторінка'
      },
      plural: {
        en: 'Pages',
        ru: 'Страницы',
        uk: 'Сторінки'
      }
    },
    versions: {
      drafts: {
        autosave: {
          interval: 375,
        },
        localizeStatus: true,
        schedulePublish: true,
      },
      maxPerDoc: 50,
    },
    fields: defaultFields,
  }

  if (pluginConfig.overrides) {
    return pluginConfig.overrides(config)
  }
  return config
}

export const pagesPlugin =
  (pluginConfig: PagesPluginConfig = {}) =>
    (incomingConfig: Config): Config => {
      if (pluginConfig.enabled === false) {
        return incomingConfig
      }

      return {
        ...incomingConfig,
        collections: [...(incomingConfig.collections ?? []), createPagesCollection(pluginConfig)],
      }
    }

export default pagesPlugin
