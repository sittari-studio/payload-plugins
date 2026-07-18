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
  return <details className="seo-schema-advanced">
    <summary>{t('showRawJson')}</summary>
    <div className="seo-schema-advanced__body">
      <p>{t('rawApplyDescription')}</p>
      <TextareaInput className="seo-schema-json-input" label={t('rawJson')} onChange={(event) => { setRaw(event.target.value); setError(undefined) }} path="seo-schema-raw-json" readOnly={readOnly} rows={18} value={raw} />
      {error ? <p className="seo-schema-error" role="alert">{error}</p> : null}
      <Button buttonStyle="primary" disabled={readOnly} onClick={apply} size="small" type="button">{t('applyJson')}</Button>
    </div>
  </details>
}
