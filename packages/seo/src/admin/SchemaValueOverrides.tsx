'use client'

import type { GroupFieldClientProps } from 'payload'
import { FieldLabel, RenderFields, useFormFields } from '@payloadcms/ui'

import { useAdminText } from './use-admin-text.js'

type FormFields = Record<string, { value?: unknown }>

const displayValue = (value: unknown, booleanLabels: { no: string; yes: string }): string | undefined => {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? booleanLabels.yes : booleanLabels.no
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined

  const record = value as Record<string, unknown>
  for (const key of ['title', 'filename', 'alt', 'name', 'id']) {
    if (typeof record[key] === 'string' && record[key].trim()) return record[key]
  }
  return undefined
}

/** Renders per-document schema overrides with the mapped document value kept visible. */
export const SchemaValueOverrides = ({ field, path = '', permissions, readOnly, schemaPath }: GroupFieldClientProps) => {
  const t = useAdminText()
  const formFields = useFormFields(([fields]) => fields as FormFields)
  const config = field.admin?.custom?.seo as {
    schemaMappings?: Record<string, string>
  } | undefined
  const mappings = config?.schemaMappings ?? {}
  const fields = field.fields.map((child) => {
    if (!('name' in child)) return child

    const documentPath = mappings[child.name]
    const inherited = documentPath ? displayValue(formFields[documentPath]?.value, { no: t('no'), yes: t('yes') }) : undefined
    if (!inherited) return child

    const existingDescription = typeof child.admin?.description === 'string' ? child.admin.description : undefined
    return {
      ...child,
      admin: {
        ...child.admin,
        description: `${existingDescription ? `${existingDescription} ` : ''}${t('schemaOverrideValue', { path: documentPath!, value: inherited })}`,
        ...(child.type === 'text' || child.type === 'textarea' || child.type === 'number' || child.type === 'date'
          ? { placeholder: inherited }
          : {}),
      },
    }
  }) as typeof field.fields

  return <section className="field-type group">
    <FieldLabel label={typeof field.label === 'string' ? field.label : t('schemaOverrides')} path={path} required={false} />
    <p style={{ color: 'var(--theme-elevation-600)', margin: '.35rem 0 1rem' }}>
      {t('schemaOverridesDescription')}
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
