'use client'

import type { GroupFieldClientProps } from 'payload'
import { RenderFields, useFormFields } from '@payloadcms/ui'

type Fields = Record<string, { value?: unknown }>

const text = (value: unknown): string | undefined => typeof value === 'string' && value.trim() ? value.trim() : undefined

const imageUrl = (value: unknown): string | undefined => {
  if (!value || typeof value !== 'object') return undefined
  return text((value as Record<string, unknown>).url)
}

const fieldValue = (fields: Fields, path: string): unknown => fields[path]?.value

const previewStyle = { border: '1px solid var(--theme-elevation-150)', borderRadius: '4px', padding: '1rem', marginBottom: '1rem' }

/** Displays informational Google, Open Graph, and Twitter/X previews from unsaved form state. */
export const SeoPreviews = ({ field, path = '', permissions, readOnly, schemaPath }: GroupFieldClientProps) => {
  const values = useFormFields(([fields]) => fields as Fields)
  const at = (name: string) => fieldValue(values, path ? `${path}.${name}` : name)
  const title = text(at('title')) ?? 'Page title'
  const description = text(at('description')) ?? 'Add a concise description to preview how this document may appear when shared.'
  const openGraphTitle = text(at('openGraph.title')) ?? title
  const openGraphDescription = text(at('openGraph.description')) ?? description
  const twitterTitle = text(at('twitter.title')) ?? openGraphTitle
  const twitterDescription = text(at('twitter.description')) ?? openGraphDescription
  const openGraphImage = imageUrl(at('openGraph.image'))
  const twitterImage = imageUrl(at('twitter.image')) ?? openGraphImage

  return <>
    <section aria-label="SEO previews">
      <div style={previewStyle}>
        <strong>Google result preview</strong>
        <div style={{ color: '#1a0dab', fontSize: '1.1rem', marginTop: '.5rem' }}>{title}</div>
        <div style={{ color: '#188038' }}>https://example.com/page</div>
        <div>{description}</div>
      </div>
      <div style={previewStyle}>
        <strong>Open Graph preview</strong>
        {openGraphImage && <img alt="" src={openGraphImage} style={{ display: 'block', marginTop: '.5rem', maxHeight: '12rem', maxWidth: '100%', objectFit: 'cover' }} />}
        <div style={{ fontSize: '1.1rem', marginTop: '.5rem' }}>{openGraphTitle}</div>
        <div>{openGraphDescription}</div>
      </div>
      <div style={previewStyle}>
        <strong>Twitter/X card preview</strong>
        {twitterImage && <img alt="" src={twitterImage} style={{ display: 'block', marginTop: '.5rem', maxHeight: '12rem', maxWidth: '100%', objectFit: 'cover' }} />}
        <div style={{ fontSize: '1.1rem', marginTop: '.5rem' }}>{twitterTitle}</div>
        <div>{twitterDescription}</div>
      </div>
    </section>
    <RenderFields
      fields={field.fields}
      parentIndexPath=""
      parentPath={path}
      parentSchemaPath={schemaPath ?? ''}
      permissions={permissions ?? true}
      readOnly={readOnly}
    />
  </>
}
