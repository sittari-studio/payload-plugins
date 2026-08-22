export const en = {
  block: 'Block',
  blocks: 'Blocks',
  content: 'Content',
  flexible: 'Flexible',
  homeSlugInstruction: 'For the home page, set the slug to "home".',
  page: 'Page',
  pages: 'Pages',
  pageType: 'Page Type',
  standardContent: 'Standard Content',
  title: 'Title',
} as const;

export type PagesTranslation = {
  [Key in keyof typeof en]: string;
};
