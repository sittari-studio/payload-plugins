# @sittari/payload-permalink

A WordPress-style permalink system for Payload CMS. The plugin owns the slug,
canonical path, published route registry, permalink editor, lookup, pagination,
and path rebuilding for selected collections.

```ts
import { permalinkPlugin } from '@sittari/payload-permalink';

permalinkPlugin({
  siteUrl: 'https://example.com',
  localePrefix: 'as-needed',
  collections: {
    pages: { prefix: '' },
    posts: { prefix: 'blog' },
    categories: {
      prefix: 'category',
      parentField: 'parent',
    },
  },
});
```

A collection prefix works like a WordPress custom post type rewrite prefix:

- `pages` + slug `about` -> `/about`
- `posts` + slug `hello-world` -> `/blog/hello-world`
- nested category `shoes` / `boots` -> `/category/shoes/boots`

Use the reserved slug `__home` for the root of a collection prefix:

- `pages` + `__home` -> `/`
- Ukrainian `pages` + `__home` -> `/uk`
- `posts` + `__home` -> `/blog`

`__home` is preserved by slug normalization and omitted only when composing the
canonical path. The constant is exported as `HOME_SLUG`.

The plugin uses the collection's `admin.useAsTitle` field as the slug source,
falling back to `title`. If a collection already has a text `slug` field, it is
reused; otherwise the plugin adds a plain localized text field. Slugs are not
unique on their own: they are normalized URL segments, while final published
path uniqueness is enforced by the route registry. If a published path is
already claimed, the new document's slug is suffixed once with `-{documentID}`
and its path is recomputed. Drafts and autosaves are left unchanged because they
do not reserve routes. If the suffixed path is also occupied, normal permalink
validation fails.

The raw slug and path fields are hidden and replaced by a WordPress-style
permalink display which edits only the final slug segment.

## Permalink UI styling

The permalink editor exposes stable global classes and uses low-specificity
default styles, so client app CSS can override them directly:

```css
.sittari-permalink-field {
  /* container */
}

.sittari-permalink-field__label {
}
.sittari-permalink-field__prefix {
}
.sittari-permalink-field__link {
}
.sittari-permalink-field__placeholder {
}
.sittari-permalink-field__input {
}
.sittari-permalink-field__error {
}
.sittari-permalink-field__button {
}
.sittari-permalink-field__button--edit {
}
.sittari-permalink-field__button--ok {
}
.sittari-permalink-field__button--cancel {
}
```

State classes are applied to the root element as needed:

```css
.sittari-permalink-field--editing {
}
.sittari-permalink-field--error {
}
.sittari-permalink-field--disabled {
}
```

## Localization

`localePrefix` defaults to `as-needed`:

```text
en: /about
uk: /uk/about
```

Use `always` to prefix every locale:

```text
en: /en/about
uk: /uk/about
```

## Hierarchical collections

When `parentField` is used, the plugin which creates that self-referencing
relationship (for example `@payloadcms/plugin-nested-docs`) must run before
`permalinkPlugin`. Child paths append their slug to the parent's canonical path.

## Published routes

Drafts and autosaves do not reserve routes. Publishing claims the canonical
path, changing a published permalink moves the claim, and unpublishing,
trashing, or deleting releases it. Global path uniqueness is enforced by the
internal route registry.

## Lookup

Create bound helpers in server-only code:

```ts
import { createPathHelpers } from '@sittari/payload-permalink';
import { getPayload } from 'payload';
import config from '@payload-config';

export const paths = createPathHelpers({
  getPayload: () => getPayload({ config }),
});
```

```ts
const result = await paths.findDocumentByPath({
  path: '/blog/hello-world',
  overrideAccess: false,
});
```

Lookup resolves the internal route first and then loads the target document.
Terminal `/page/:page` paths are interpreted automatically, with exact stored
routes taking precedence over pagination fallback.
