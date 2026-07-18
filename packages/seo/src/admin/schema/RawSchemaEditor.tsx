'use client'

import { Button, TextareaInput } from '@payloadcms/ui'
import { useEffect, useState } from 'react'

import { hasSameSchemaStructure } from '../../schema/editor.js'
import { validateSchemaObject } from '../../schema/json.js'
import type { JsonObject } from '../../schema/types.js'
import { useAdminText } from '../use-admin-text.js'

export const RawSchemaEditor = ({ baseSchema, onApply, readOnly, schema, structuralLocked }: {
  baseSchema?: JsonObject
  onApply: (schema: JsonObject) => void
  readOnly?: boolean
  schema: JsonObject
  structuralLocked?: boolean
}) => {
  const t = useAdminText()
  const formatted = JSON.stringify(schema, null, 2)
  const [raw, setRaw] = useState(formatted)
  const [error, setError] = useState<string>()
  useEffect(() => { setRaw(formatted); setError(undefined) }, [formatted])
  const apply = () => {
    try {
      const parsed: unknown = JSON.parse(raw)
      const valid = validateSchemaObject(parsed)
      if (valid !== true) { setError(t(valid.includes('@context') ? 'validationSchemaContext' : 'validationSchemaRoot')); return }
      if (structuralLocked && baseSchema && !hasSameSchemaStructure(baseSchema, parsed as JsonObject)) { setError(t('localizedStructureError')); return }
      onApply(parsed as JsonObject)
      setError(undefined)
    } catch {
      setError(t('validationJson'))
    }
  }
  return <details className="st-border-0 st-border-t st-border-solid st-border-elevation-150 st-pt-base">
    <summary className="st-cursor-pointer st-font-semibold">{t('showRawJson')}</summary>
    <div className="st-mt-base-60 st-grid st-gap-base-60">
      <p>{t('rawApplyDescription')}</p>
      <TextareaInput className="[&_textarea]:st-min-h-[280px] [&_textarea]:st-w-full [&_textarea]:st-font-mono" label={t('rawJson')} onChange={(event) => { setRaw(event.target.value); setError(undefined) }} path="seo-schema-raw-json" readOnly={readOnly} rows={18} value={raw} />
      {error ? <p className="st-rounded-sm st-bg-error-100 st-p-base-55 !st-text-error-700" role="alert">{error}</p> : null}
      <Button buttonStyle="primary" disabled={readOnly} onClick={apply} size="small" type="button">{t('applyJson')}</Button>
    </div>
  </details>
}
