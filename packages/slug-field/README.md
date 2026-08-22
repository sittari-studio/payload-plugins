# @sittari/payload-slug-field

A reusable, configurable Payload slug-field factory.

## Install

```bash
pnpm add @sittari/payload-slug-field
```

## Usage

```ts
import { createSlugField } from '@sittari/payload-slug-field';

export const Posts = {
  slug: 'posts',
  fields: [
    { name: 'title', type: 'text', required: true },
    createSlugField({
      instruction: {
        en: 'The slug becomes part of the page URL.',
        uk: 'Слаг стає частиною URL сторінки.',
      },
    }),
  ],
};
```

`createSlugField()` returns Payload's slug row. It is required, localized, uses `title` as its source, and appears in the sidebar by default. It adds no instruction text unless `instruction` is provided.

Use `overrides` to modify or replace the completed row:

```ts
createSlugField({
  useAsSlug: 'name',
  localized: false,
  overrides: (defaultSlugField) => ({
    ...defaultSlugField,
    admin: { ...defaultSlugField.admin, position: 'sidebar' },
  }),
});
```
