export const en = {
  editTemplate: 'Edit template',
  template: 'Template',
  templates: 'Templates',
} as const

export type TemplatesTranslation = {
  [Key in keyof typeof en]: string
}
