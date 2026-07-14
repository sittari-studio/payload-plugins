import type { RowField } from 'payload'

export type SlugInstruction = Record<string, string>

export type CreateSlugFieldOptions = {
  /** Locale-keyed instructional text displayed below the slug field. */
  instruction?: SlugInstruction
  /** Whether the generated slug is localized. */
  localized?: boolean
  /** Position of the generated row in the Payload admin UI. */
  position?: 'sidebar'
  /** Whether a slug value is required. */
  required?: boolean
  /** Source field used by Payload to generate the slug. */
  useAsSlug?: string
  /** Extend or replace the completed Payload slug row. */
  overrides?: (defaultSlugField: RowField) => RowField
}
