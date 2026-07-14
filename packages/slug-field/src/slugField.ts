import type { RowField, TextField, UIField } from 'payload'
import { slugField } from 'payload'
import slugify from 'slugify'

import type { CreateSlugFieldOptions } from './types.js'

const SLUG_INSTRUCTION_COMPONENT = '@sittari/payload-slug-field/client#SlugInstruction'

export const createSlugField = ({
  instruction,
  localized = true,
  overrides,
  position = 'sidebar',
  required = true,
  useAsSlug = 'title',
}: CreateSlugFieldOptions = {}): RowField => {
  const defaultSlugField = slugField({
    useAsSlug,
    required,
    localized,
    position,
    overrides: (field) => {
      const slugIndex = field.fields.findIndex((child) => child.type === 'text' && 'name' in child && child.name === 'slug')
      if (slugIndex === -1) return field

      const slug = field.fields[slugIndex] as TextField
      const fields = [...field.fields]
      fields[slugIndex] = {
        ...slug,
        label: { en: 'Slug', ru: 'Слаг', uk: 'Слаг' },
      }

      if (instruction && Object.keys(instruction).length > 0) {
        const instructionField: UIField = {
          name: 'slugInstruction',
          type: 'ui',
          admin: {
            disableListColumn: true,
            disableBulkEdit: true,
            components: { Field: SLUG_INSTRUCTION_COMPONENT },
            custom: { slugField: { instruction } },
          },
        }
        fields.splice(slugIndex + 1, 0, instructionField)
      }

      return { ...field, fields }
    },
    slugify: ({ valueToSlugify }) =>
      typeof valueToSlugify === 'string' && valueToSlugify.length > 0
        ? slugify(valueToSlugify, { lower: true, replacement: '-', strict: true })
        : '',
  })

  return overrides ? overrides(defaultSlugField) : defaultSlugField
}
