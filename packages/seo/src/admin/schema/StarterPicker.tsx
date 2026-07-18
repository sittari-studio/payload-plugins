'use client'

import { Button, TextareaInput } from '@payloadcms/ui'
import { useState } from 'react'

import { createSchemaStarter, SEO_SCHEMA_STARTERS, type SeoSchemaStarter } from '../../schema/starters.js'
import { parseSchemaImport, removeManagedContext } from '../../schema/editor.js'
import type { JsonObject } from '../../schema/types.js'
import { useAdminText } from '../use-admin-text.js'

const STARTERS = Object.keys(SEO_SCHEMA_STARTERS) as SeoSchemaStarter[]

export const StarterPicker = ({ onChoose }: { onChoose: (name: string, schema: JsonObject) => void }) => {
  const t = useAdminText()
  const [importing, setImporting] = useState(false)
  const [raw, setRaw] = useState('')
  const [error, setError] = useState<string>()
  const [contextSchema, setContextSchema] = useState<JsonObject>()

  const importJson = () => {
    const result = parseSchemaImport(raw)
    if (!result.ok) {
      setError(t(result.reason === 'root' ? 'validationSchemaRoot' : 'validationJson'))
      return
    }
    if (result.hasManagedContext) {
      setContextSchema(result.schema)
      setError(t('importContextExplanation'))
      return
    }
    onChoose(t('importedSchema'), result.schema)
  }

  if (importing) return <div className="seo-schema-import">
    <button className="seo-schema-link" onClick={() => { setImporting(false); setError(undefined); setContextSchema(undefined) }} type="button">← {t('backToStarters')}</button>
    <h3>{t('importJson')}</h3>
    <p>{t('importJsonDescription')}</p>
    <TextareaInput className="seo-schema-json-input" label={t('rawJson')} onChange={(event) => { setRaw(event.target.value); setError(undefined); setContextSchema(undefined) }} path="seo-schema-import-json" rows={18} value={raw} />
    {error ? <p className={contextSchema ? 'seo-schema-notice' : 'seo-schema-error'} role={contextSchema ? 'status' : 'alert'}>{error}</p> : null}
    <div className="seo-schema-inline-actions">
      {contextSchema ? <Button buttonStyle="primary" onClick={() => onChoose(t('importedSchema'), removeManagedContext(contextSchema))} type="button">{t('removeAndContinue')}</Button> : <Button buttonStyle="primary" onClick={importJson} type="button">{t('continue')}</Button>}
    </div>
  </div>

  return <div>
    <div className="seo-schema-section-heading">
      <div><h3>{t('chooseStarter')}</h3><p>{t('chooseStarterDescription')}</p></div>
    </div>
    <div className="seo-schema-starter-grid">
      {STARTERS.map((starter) => <article className="seo-schema-starter-card" key={starter}>
        <h4>{starter}</h4>
        <Button buttonStyle="secondary" onClick={() => onChoose(starter, createSchemaStarter(starter))} size="small" type="button">{t('use')}</Button>
      </article>)}
      <article className="seo-schema-starter-card">
        <div><h4>{t('startScratch')}</h4><p>{t('startScratchDescription')}</p></div>
        <Button buttonStyle="secondary" onClick={() => onChoose(t('untitledSchema'), {})} size="small" type="button">{t('use')}</Button>
      </article>
      <article className="seo-schema-starter-card">
        <div><h4>{t('importJson')}</h4><p>{t('importJsonDescription')}</p></div>
        <Button buttonStyle="secondary" onClick={() => setImporting(true)} size="small" type="button">{t('use')}</Button>
      </article>
    </div>
  </div>
}
