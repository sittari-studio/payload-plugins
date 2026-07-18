'use client'

import { Banner, Button, CheckboxInput, TextInput } from '@payloadcms/ui'
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
  return <div className="st-grid st-gap-base [&_.field-type]:st-mb-0 [&_.checkbox-input]:st-mb-0 [&_p]:st-mt-[.35rem] [&_p]:st-mb-0 [&_p]:st-text-elevation-600">
    {onReplace && !structuralLocked && !readOnly ? <nav className="st-border-0 st-border-b st-border-solid st-border-elevation-150 st-pb-base-60" aria-label={t('backToStarters')}><Button buttonStyle="transparent" margin={false} onClick={onReplace} type="button">← {t('backToStarters')}</Button></nav> : null}
    <header className="st-flex st-items-center st-justify-between st-gap-base max-[600px]:st-flex-col max-[600px]:st-items-stretch">
      <div className="st-flex st-flex-1 st-items-end st-gap-base max-[600px]:st-flex-col max-[600px]:st-items-stretch">
        <TextInput className="st-flex-1" label={t('schemaName')} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange({ ...draft, name: event.target.value })} path="seo-schema-name" readOnly={structuralLocked || readOnly} value={draft.name} />
        {collectionTemplate ? <CheckboxInput checked={draft.isDefault === true} className="st-pb-base-35" label={t('defaultSchema')} name="seo-schema-default" onToggle={(event: ChangeEvent<HTMLInputElement>) => onChange({ ...draft, isDefault: event.target.checked })} readOnly={structuralLocked || readOnly} /> : null}
      </div>
    </header>
    {showLocalizedNotice ? <Banner>{t('localizedEditingNotice')}</Banner> : null}
    <RecursiveSchemaEditor baseSchema={baseDraft?.schema} onChange={(schema) => onChange({ ...draft, schema })} readOnly={readOnly} schema={draft.schema} structuralLocked={structuralLocked} variables={variables} />
    <RawSchemaEditor baseSchema={baseDraft?.schema} onApply={(schema) => onChange({ ...draft, schema })} readOnly={readOnly} schema={draft.schema} structuralLocked={structuralLocked} />
  </div>
}
