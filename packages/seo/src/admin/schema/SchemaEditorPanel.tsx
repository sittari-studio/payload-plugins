'use client'

import { CheckboxInput, TextInput } from '@payloadcms/ui'
import type { ChangeEvent } from 'react'

import type { SeoSchemaVariable } from '../../schema/types.js'
import { useAdminText } from '../use-admin-text.js'
import { RawSchemaEditor } from './RawSchemaEditor.js'
import { RecursiveSchemaEditor } from './RecursiveSchemaEditor.js'
import type { EditorDraft } from './types.js'

export const SchemaEditorPanel = ({ baseDraft, collectionTemplate, draft, onChange, onReplace, readOnly, showLocalizedNotice, structuralLocked, variables }: {
  baseDraft?: EditorDraft
  collectionTemplate?: boolean
  draft: EditorDraft
  onChange: (draft: EditorDraft) => void
  onReplace?: () => void
  readOnly?: boolean
  showLocalizedNotice?: boolean
  structuralLocked?: boolean
  variables: SeoSchemaVariable[]
}) => {
  const t = useAdminText()
  return <div className="seo-schema-editor">
    {onReplace && !structuralLocked && !readOnly ? <nav className="seo-schema-editor__navigation" aria-label={t('backToStarters')}><button className="seo-schema-link" onClick={onReplace} type="button">← {t('backToStarters')}</button></nav> : null}
    <header className="seo-schema-editor__header">
      <div className="seo-schema-meta-fields">
        <TextInput className="seo-schema-name-input" label={t('schemaName')} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange({ ...draft, name: event.target.value })} path="seo-schema-name" readOnly={structuralLocked || readOnly} value={draft.name} />
        {collectionTemplate ? <CheckboxInput checked={draft.isDefault === true} className="seo-schema-default-input" label={t('defaultSchema')} name="seo-schema-default" onToggle={(event: ChangeEvent<HTMLInputElement>) => onChange({ ...draft, isDefault: event.target.checked })} readOnly={structuralLocked || readOnly} /> : null}
      </div>
    </header>
    {showLocalizedNotice ? <div className="seo-schema-notice">{t('localizedEditingNotice')}</div> : null}
    <RecursiveSchemaEditor baseSchema={baseDraft?.schema} onChange={(schema) => onChange({ ...draft, schema })} readOnly={readOnly} schema={draft.schema} structuralLocked={structuralLocked} variables={variables} />
    <RawSchemaEditor baseSchema={baseDraft?.schema} onApply={(schema) => onChange({ ...draft, schema })} readOnly={readOnly} schema={draft.schema} structuralLocked={structuralLocked} />
  </div>
}
