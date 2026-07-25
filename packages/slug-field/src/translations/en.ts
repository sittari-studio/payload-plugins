export const en = {
  slug: 'Slug',
} as const

export type SlugFieldTranslation = {
  [Key in keyof typeof en]: string
}
