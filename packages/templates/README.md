# @sittari/payload-templates

A Payload CMS plugin that creates one managed document for every developer-defined template. Users can edit template content, but cannot create, duplicate, delete, or change the identity of template documents.

## Install

```bash
pnpm add @sittari/payload-templates
```

## Usage

```ts
import { templateField, templatesPlugin } from '@sittari/payload-templates';
import { buildConfig } from 'payload';

export default buildConfig({
  collections: [
    {
      slug: 'pages',
      fields: [
        templateField({
          name: 'notFoundContent',
          template: '404',
        }),
      ],
    },
  ],
  plugins: [
    templatesPlugin({
      templates: [
        {
          name: '404',
          label: 'Page 404',
          fields: [
            { name: 'heading', type: 'text', required: true },
            { name: 'message', type: 'textarea' },
          ],
          initialData: {
            heading: 'Page not found',
          },
        },
      ],
    }),
  ],
});
```

The generated document stores editable fields under `data_<name>`—for example, `data_404.heading`. The `title` and `templateType` fields are managed by the plugin and hidden from the admin form.

## Template-backed fields

### `templateField()`

```ts
templateField(config: TemplateFieldConfig): GroupField
```

Creates a named Payload group whose fields and fallback values come from a
template registered with `templatesPlugin()`. It can be used anywhere Payload
accepts fields, including collections, globals, tabs, arrays, and blocks.

```ts
import { templateField } from '@sittari/payload-templates';
import type { CollectionConfig } from 'payload';

export const Pages: CollectionConfig = {
  slug: 'pages',
  fields: [
    templateField({
      name: 'hero',
      template: 'defaultHero',
      label: {
        en: 'Hero overrides',
        uk: 'Перевизначення Hero',
      },
      admin: {
        hideGutter: true,
      },
    }),
  ],
};
```

| Option     | Type                  | Required | Description                                                                                                                   |
| ---------- | --------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `name`     | `string`              | Yes      | Field name used in the consuming document. Its stored overrides live at this property.                                        |
| `template` | `string`              | Yes      | `name` of a template registered with `templatesPlugin()`. Unknown names throw during configuration.                           |
| `label`    | `GroupField['label']` | No       | Payload group label. Static strings, localized label maps, and label functions are supported.                                 |
| `admin`    | `GroupField['admin']` | No       | Payload Admin settings for the generated group. The plugin preserves these settings and installs its template field renderer. |

The function initially returns a marked group definition. During plugin
configuration, `templatesPlugin()` replaces its empty field list with an
optionalized copy of the registered template fields and adds the fallback hook.
Consequently, `templateField()` must be used in the same Payload config as an
enabled `templatesPlugin()` call containing the referenced template.

The consuming document stores only local overrides:

```ts
// Managed template: data_defaultHero
{
  heading: 'Build something useful',
  summary: 'Default summary',
}

// Page document: hero
{
  heading: 'A page-specific heading',
  // Empty summary inherits "Default summary".
}
```

Fields copied into the consuming group are optional, even when the managed
template requires them. On read, empty local values inherit from the managed
template:

- `undefined`, `null`, `''`, empty arrays, and empty plain objects inherit.
- `false`, `0`, and whitespace-only strings remain explicit local values.
- Nested groups and tabs inherit field by field.
- Arrays and blocks inherit as a whole only when empty. A non-empty local list
  is treated as the complete override.

Inheritance is read-time only. Fallback values are not written into the
consuming document, so later edits to the managed template are reflected on the
next API read. Admin edit forms receive the raw stored overrides. Empty
supported inputs display the active locale's managed template value as a
placeholder, and each template-backed group includes a localized link to edit
that template document. The Admin API inspector still displays resolved values.

You can explicitly control resolution for Local API operations through Payload
request context:

```ts
await payload.findByID({
  collection: 'pages',
  id,
  context: {
    templateFields: 'raw', // or 'resolved'
  },
});
```

An explicit context mode takes precedence over automatic Admin request
detection. Template-backed fields cannot be nested inside a template
definition.

## Configuration

| Option      | Type               | Default  | Description                                           |
| ----------- | ------------------ | -------- | ----------------------------------------------------- |
| `templates` | `TemplateConfig[]` | Required | Complete set of managed template definitions.         |
| `enabled`   | `boolean`          | `true`   | Set to `false` to leave the Payload config unchanged. |

Each template has:

- `name`: stable unique identifier containing only letters, numbers, and underscores.
- `label`: admin document title.
- `fields`: Payload fields shown for this template.
- `initialData`: optional values applied only when the document is first created. Payload field defaults still apply.

## Lifecycle and access

On Payload initialization, the plugin creates missing documents, updates labels, and deletes documents removed from configuration. Existing editable data is preserved. Renaming a template is treated as removing the old template and creating a new one.

Collection access prevents normal admin, REST, GraphQL, and access-controlled Local API users from creating or deleting template documents. The identity fields also deny user changes. As with every Payload collection, trusted Local API calls using the default `overrideAccess: true` bypass access control.

The package exports `TemplateConfig`, `TemplateFieldConfig`, and
`TemplatesPluginConfig` from both the package root and
`@sittari/payload-templates/types`.

## Fetching a typed template

Create a lookup helper with the generated `Template` type from your project:

```ts
import config from '@payload-config';
import { createTemplateGetter } from '@sittari/payload-templates';
import { getPayload } from 'payload';

import type { Template } from './payload-types';

export const getTemplate = createTemplateGetter<Template>(() =>
  getPayload({ config }),
);

const notFound = await getTemplate('404');
// Typed as: { id: string | number; data_404?: Template['data_404'] } | null
```

Valid template names are inferred from the generated type's `data_*` properties. Each lookup filters by `templateType` and selects only the matching `data_<name>` group (plus Payload's always-selected document ID). It returns `null` when no configured document is found.
