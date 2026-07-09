'use client'

import type { GroupFieldClientProps } from 'payload'
import { FieldLabel, RenderFields, useFormFields } from '@payloadcms/ui'

type FormFields = Record<string, { value?: unknown }>

const displayValue = (value: unknown): string | undefined => {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined

  const record = value as Record<string, unknown>
  for (const key of ['title', 'filename', 'alt', 'name', 'id']) {
    if (typeof record[key] === 'string' && record[key].trim()) return record[key]
  }
  return undefined
}

/** Renders per-document schema overrides with the mapped document value kept visible. */
export const SchemaValueOverrides = ({ field, path = '', permissions, readOnly, schemaPath }: GroupFieldClientProps) => {
  const formFields = useFormFields(([fields]) => fields as FormFields)
  const config = field.admin?.custom?.seo as {
    schemaMappings?: Record<string, string>
  } | undefined
  const mappings = config?.schemaMappings ?? {}
  const fields = field.fields.map((child) => {
    if (!('name' in child)) return child

    const documentPath = mappings[child.name]
    const inherited = documentPath ? displayValue(formFields[documentPath]?.value) : undefined
    if (!inherited) return child

    const existingDescription = typeof child.admin?.description === 'string' ? child.admin.description : undefined
    return {
      ...child,
      admin: {
        ...child.admin,
        description: `${existingDescription ? `${existingDescription} ` : ''}Using ${documentPath}: ${inherited}. Enter a value only to override it.`,
        ...(child.type === 'text' || child.type === 'textarea' || child.type === 'number' || child.type === 'date'
          ? { placeholder: inherited }
          : {}),
      },
    }
  }) as typeof field.fields

  return <section className="field-type group">
    <FieldLabel label={typeof field.label === 'string' ? field.label : 'Schema overrides'} path={path} required={false} />
    <p style={{ color: 'var(--theme-elevation-600)', margin: '.35rem 0 1rem' }}>
      Values configured by your developer are inherited from this document. Leave a field empty to use its mapped value.
    </p>
    <RenderFields
      fields={fields}
      parentIndexPath=""
      parentPath={path}
      parentSchemaPath={schemaPath ?? ''}
      permissions={permissions ?? true}
      readOnly={readOnly}
    />
  </section>
}
