export const en = {
  translations: 'Translations',
} as const;

export type StringsTranslation = {
  [Key in keyof typeof en]: string;
};
