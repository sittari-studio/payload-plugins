import type { CollectionConfig, Config, Field, TextField, UIField } from 'payload'
import { slugField } from 'payload'
import slugify from 'slugify'

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

const createDefaultSlugField = ({
  useAsSlug = 'title',
}) => slugField({
  useAsSlug,
  required: true,
  localized: true,
  position: 'sidebar',

  overrides: (defaultField) => {
    const slugIndex = defaultField.fields.findIndex(
      (field) =>
        field.type === 'text' &&
        'name' in field &&
        field.name === 'slug',
    )

    if (slugIndex === -1) {
      return defaultField
    }

    const field = defaultField.fields[slugIndex] as TextField

    const instructionField: UIField = {
      name: 'slugInstruction',
      type: 'ui',
      admin: {
        disableListColumn: true,
        disableBulkEdit: true,
        components: {
          Field: '@krameri/payload-pages/client#SlugInstruction',
        },
      },
    }

    defaultField.fields.splice(
      slugIndex,
      1,
      {
        ...field,
        label: {
          en: 'Slug',
          ru: 'Слаг',
          uk: 'Слаг',
        },
      },
      instructionField,
    )

    return defaultField
  },

  slugify: ({ valueToSlugify }) =>
    typeof valueToSlugify === 'string' && valueToSlugify.length > 0
      ? slugify(valueToSlugify, {
        lower: true,
        replacement: '-',
        strict: true,
      })
      : '',
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

  const defaultSlugField = createDefaultSlugField({})
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

  return {
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
    fields: pluginConfig.fields?.({ defaultFields }) ?? defaultFields,
  }
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
