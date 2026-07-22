# @sittari/payload-templates

A Payload CMS plugin that creates one managed document for every developer-defined template. Users can edit template content, but cannot create, duplicate, delete, or change the identity of template documents.

## Install

```bash
pnpm add @sittari/payload-templates
```

## Usage

```ts
import { templatesPlugin } from '@sittari/payload-templates'
import { buildConfig } from 'payload'

export default buildConfig({
  collections: [],
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
})
```

The generated document stores editable fields under `data_<name>`—for example, `data_404.heading`. The `title` and `templateType` fields are managed by the plugin and hidden from the admin form.

## Configuration

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `templates` | `TemplateConfig[]` | Required | Complete set of managed template definitions. |
| `enabled` | `boolean` | `true` | Set to `false` to leave the Payload config unchanged. |

Each template has:

- `name`: stable unique identifier containing only letters, numbers, and underscores.
- `label`: admin document title.
- `fields`: Payload fields shown for this template.
- `initialData`: optional values applied only when the document is first created. Payload field defaults still apply.

## Lifecycle and access

On Payload initialization, the plugin creates missing documents, updates labels, and deletes documents removed from configuration. Existing editable data is preserved. Renaming a template is treated as removing the old template and creating a new one.

Collection access prevents normal admin, REST, GraphQL, and access-controlled Local API users from creating or deleting template documents. The identity fields also deny user changes. As with every Payload collection, trusted Local API calls using the default `overrideAccess: true` bypass access control.

The package exports `TemplateConfig` and `TemplatesPluginConfig` from both the package root and `@sittari/payload-templates/types`.

## Fetching a typed template

Create a lookup helper with the generated `Template` type from your project:

```ts
import config from '@payload-config'
import { createTemplateGetter } from '@sittari/payload-templates'
import { getPayload } from 'payload'

import type { Template } from './payload-types'

export const getTemplate = createTemplateGetter<Template>(() => getPayload({ config }))

const notFound = await getTemplate('404')
// Typed as: { id: string | number; data_404?: Template['data_404'] } | null
```

Valid template names are inferred from the generated type's `data_*` properties. Each lookup filters by `templateType` and selects only the matching `data_<name>` group (plus Payload's always-selected document ID). It returns `null` when no configured document is found.
