'use client'

import type { TextareaFieldClientProps } from 'payload'
import { Button, FieldError, FieldLabel, useField, useFormFields } from '@payloadcms/ui'

import { buildGeneratedSchema } from '../utils/generated-schema.js'
import { isAbsoluteHttpUrl } from '../utils/validation.js'
import { useAdminText } from './use-admin-text.js'

/** A focused raw-schema editor that can clear only the explicit JSON override. */
export const ResetRawJson = ({ field, path, readOnly }: TextareaFieldClientProps) => {
  const t = useAdminText()
  const { errorMessage, setValue, showError, value } = useField<string>({ path })
  const fields = useFormFields(([formFields]) => formFields as Record<string, { value?: unknown }>)
  const label = typeof field.label === 'string' ? field.label : t('rawJson')
  const config = field.admin?.custom?.seo as {
    collectionSchema?: Record<string, string>
    defaultType?: 'Article' | 'FAQPage' | 'LocalBusiness' | 'Organization' | 'Product' | 'WebPage'
    seoField?: string
  } | undefined
  const seoField = config?.seoField ?? 'seo'
  const schemaPath = `${seoField}.schema`
  const document = Object.entries(fields).reduce<Record<string, unknown>>((data, [fieldPath, state]) => {
    if (!fieldPath || fieldPath.startsWith(`${seoField}.`)) return data
    const segments = fieldPath.split('.')
    let target = data
    for (const segment of segments.slice(0, -1)) {
      const existing = target[segment]
      target = existing && typeof existing === 'object' && !Array.isArray(existing)
        ? existing as Record<string, unknown>
        : target[segment] = {}
    }
    target[segments.at(-1)!] = state.value
    return data
  }, {})
  const schemaValues = Object.entries(fields).reduce<Record<string, unknown>>((values, [fieldPath, state]) => {
    const prefix = `${schemaPath}.values.`
    if (fieldPath.startsWith(prefix)) values[fieldPath.slice(prefix.length)] = state.value
    return values
  }, {})
  const manualCanonical = fields[`${seoField}.canonical.url`]?.value
  const generatedJson = JSON.stringify(buildGeneratedSchema({
    canonicalUrl: fields[`${seoField}.canonical.mode`]?.value === 'manual' && isAbsoluteHttpUrl(manualCanonical)
      ? manualCanonical.trim()
      : undefined,
    collectionSchema: config?.collectionSchema,
    defaultType: config?.defaultType ?? 'WebPage',
    document: {
      ...document,
    },
    schema: {
      type: fields[`${schemaPath}.type`]?.value,
      values: schemaValues,
    },
  }), null, 2)

  return <div className="field-type textarea">
    <div style={{ marginBottom: '1rem' }}>
      <strong>{t('generatedJson')}</strong>
      <p style={{ color: 'var(--theme-elevation-600)', margin: '.35rem 0 .5rem' }}>
        {t('generatedJsonDescription')}
      </p>
      <pre style={{ background: 'var(--theme-elevation-50)', border: '1px solid var(--theme-elevation-150)', borderRadius: '6px', margin: 0, maxHeight: '18rem', overflow: 'auto', padding: '1rem' }}>{generatedJson}</pre>
      <Button buttonStyle="secondary" disabled={readOnly} onClick={() => setValue(generatedJson)} size="small" type="button">
        {t('useGeneratedJson')}
      </Button>
    </div>
    <FieldLabel label={label} path={path} required={field.required} />
    <p style={{ color: 'var(--theme-elevation-600)', margin: '.35rem 0 .5rem' }}>
      {t('rawJsonDescription')}
    </p>
    <textarea
      aria-label={label}
      disabled={readOnly}
      onChange={(event) => setValue(event.target.value)}
      rows={10}
      value={value ?? ''}
    />
    <Button buttonStyle="secondary" disabled={readOnly || !value} onClick={() => setValue('')} size="small" type="button">
      {t('clearRawJson')}
    </Button>
    {showError && <FieldError message={errorMessage} />}
  </div>
}
