import type { PageTypeConfig } from './types.js'
import { localizedText } from './translations/index.js'

export type StandardContentPageTypeOptions = Partial<PageTypeConfig>

export type FlexiblePageTypeOptions = Partial<PageTypeConfig> & {
  blockSlugs?: string[]
}

export const createStandardContentPageType = (
  options: StandardContentPageTypeOptions = {},
): PageTypeConfig => ({
  label: localizedText('standardContent'),
  fields: [
    {
      name: 'content',
      label: localizedText('content'),
      type: 'richText',
      localized: true,
    },
  ],
  ...options,
})

export const createFlexiblePageType = (
  options: FlexiblePageTypeOptions = {},
): PageTypeConfig => {
  const { blockSlugs = [], ...overrides } = options

  return {
    label: localizedText('flexible'),
    fields: [
      {
        name: 'blocks',
        type: 'blocks',
        label: localizedText('blocks'),
        labels: {
          singular: localizedText('block'),
          plural: localizedText('blocks'),
        },
        blockReferences: blockSlugs,
        blocks: [],
      },
    ],
    ...overrides,
  }
}
