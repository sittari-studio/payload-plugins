'use client'

import { Banner, Button, CheckboxInput, Collapsible, Pill, Popup, SelectInput, TextInput } from '@payloadcms/ui'
import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'

import { createSchemaValue, duplicateSchemaEntry, removeSchemaEntry, renameSchemaProperty, reorderSchemaEntry, schemaValueType, type SchemaValueType, uniquePropertyName } from '../../schema/editor.js'
import type { JsonObject, JsonValue, SeoSchemaVariable } from '../../schema/types.js'
import { useAdminText } from '../use-admin-text.js'
import { VariableInput } from './VariableInput.js'

const TYPES: SchemaValueType[] = ['string', 'number', 'boolean', 'null', 'object', 'array']

const childAt = (base: JsonValue | undefined, key: number | string): JsonValue | undefined => {
  if (Array.isArray(base) && typeof key === 'number') return base[key]
  if (base && typeof base === 'object' && !Array.isArray(base) && typeof key === 'string') return base[key]
  return undefined
}

const same = (left: JsonValue | undefined, right: JsonValue | undefined) => JSON.stringify(left) === JSON.stringify(right)

const PropertyNameInput = ({ disabled, name, onCommit, path }: {
  disabled?: boolean
  name: string
  onCommit: (name: string) => void
  path: string
}) => {
  const [draft, setDraft] = useState(name)
  useEffect(() => setDraft(name), [name])
  return <div className="seo-schema-compact-field st-h-full" onBlur={() => onCommit(draft)}>
    <TextInput onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft(event.target.value)} path={path} readOnly={disabled} value={draft} />
  </div>
}

const ScalarEditor = ({ baseValue, locked, onChange, path, readOnly, value, variables }: {
  baseValue?: JsonValue
  locked?: boolean
  onChange: (value: JsonValue) => void
  path: string
  readOnly?: boolean
  value: JsonValue
  variables: SeoSchemaVariable[]
}) => {
  const t = useAdminText()
  const overridden = locked && baseValue !== undefined && !same(baseValue, value)
  const [editingInherited, setEditingInherited] = useState(false)
  const reset = () => {
    if (baseValue === undefined) return
    onChange(baseValue)
    setEditingInherited(false)
  }
  const controls = locked ? <span className="st-flex st-h-full st-min-h-0 st-items-center st-justify-center st-gap-1.5 st-whitespace-nowrap st-text-[11px] st-text-elevation-550">
    {overridden || editingInherited ? <Button buttonStyle="subtle" disabled={readOnly} margin={false} onClick={reset} size="xsmall" type="button">{t('reset')}</Button> : <><Pill size="small">{t('inherited')}</Pill><Button buttonStyle="subtle" disabled={readOnly} margin={false} onClick={() => setEditingInherited(true)} size="xsmall" type="button">{t('overrideValue')}</Button></>}
  </span> : null
  if (typeof value === 'boolean') return <div className="st-flex st-h-full st-min-h-0 st-min-w-0 st-items-stretch st-gap-1.5"><CheckboxInput checked={value} label={value ? t('true') : t('false')} name={path} onToggle={(event) => onChange(event.target.checked)} readOnly={readOnly} />{controls}</div>
  if (typeof value === 'number') return <div className="seo-schema-compact-field st-flex st-h-full st-min-h-0 st-min-w-0 st-items-stretch st-gap-1.5"><TextInput onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(Number(event.target.value))} path={path} readOnly={readOnly} value={String(value)} />{controls}</div>
  if (value === null) return <div className="st-flex st-h-full st-min-h-0 st-min-w-0 st-items-stretch st-gap-1.5"><Pill className="st-font-mono" pillStyle="light-gray">null</Pill>{controls}</div>
  return <div className="st-flex st-h-full st-min-h-0 st-min-w-0 st-items-stretch st-gap-1.5"><VariableInput disabled={readOnly} onChange={onChange} onFocus={() => setEditingInherited(true)} path={path} value={String(value)} variables={variables} />{controls}</div>
}

const TypeMenu = ({ close, onChoose }: { close: () => void; onChoose: (type: SchemaValueType) => void }) => {
  const t = useAdminText()
  return <div className="st-grid st-min-w-[180px]" role="menu">
    {TYPES.map((type) => <Button buttonStyle="transparent" extraButtonProps={{ role: 'menuitem' }} key={type} margin={false} onClick={() => { onChoose(type); close() }} size="small" type="button">{t(type)}</Button>)}
  </div>
}

const ContainerEditor = ({ baseValue, breadcrumb, locked, onChange, readOnly, value, variables }: {
  baseValue?: JsonValue
  breadcrumb: string[]
  locked?: boolean
  onChange: (value: JsonValue) => void
  readOnly?: boolean
  value: JsonObject | JsonValue[]
  variables: SeoSchemaVariable[]
}) => {
  const t = useAdminText()
  const entries: Array<[number | string, JsonValue]> = Array.isArray(value) ? value.map((child, index) => [index, child]) : Object.entries(value)
  const replaceChild = (key: number | string, child: JsonValue) => {
    if (Array.isArray(value) && typeof key === 'number') { const copy = [...value]; copy[key] = child; onChange(copy) }
    else if (!Array.isArray(value) && typeof key === 'string') onChange({ ...value, [key]: child })
  }
  const add = (type: SchemaValueType) => {
    const child = createSchemaValue(type)
    onChange(Array.isArray(value) ? [...value, child] : { ...value, [uniquePropertyName(value)]: child })
  }
  return <div className="st-grid st-gap-base-50">
    <div className="st-font-mono st-text-[11px] st-text-elevation-550" aria-label={t('breadcrumb')}>{breadcrumb.length ? breadcrumb.join(' › ') : t('schemaRoot')}</div>
    {!entries.length ? <Banner type="info">{Array.isArray(value) ? t('emptyArray') : t('emptyObject')}</Banner> : null}
    <div className="st-grid st-gap-base-40">
      {entries.map(([key, child], index) => {
        const childType = schemaValueType(child)
        const nested = childType === 'object' || childType === 'array'
        return <div className="st-grid st-gap-base-25" key={`${String(key)}:${index}`}>
          <article className="st-box-border st-h-14 st-max-h-14 st-min-h-14 st-rounded-md st-border st-border-solid st-border-elevation-150 st-bg-elevation-0 st-p-1">
            <div className="st-grid st-h-full st-min-h-0 st-min-w-0 st-grid-cols-[minmax(0,.35fr)_minmax(0,.2fr)_minmax(0,1fr)_auto] st-items-stretch st-gap-2 [&>*]:st-min-h-0 [&>*]:st-min-w-0">
              {Array.isArray(value) ? <Pill className="st-font-mono" pillStyle="light-gray">{index + 1}</Pill> : <PropertyNameInput disabled={locked || readOnly} name={String(key)} onCommit={(name) => onChange(renameSchemaProperty(value, String(key), name))} path={`seo-schema-property-${breadcrumb.join('-')}-${String(key)}`} />}
              <SelectInput className="seo-schema-select st-h-full st-min-h-0 st-min-w-0" isClearable={false} name={`schema-type-${breadcrumb.join('-')}-${String(key)}`} onChange={(option) => { if (!Array.isArray(option) && typeof option?.value === 'string') replaceChild(key, createSchemaValue(option.value as SchemaValueType)) }} options={TYPES.map((type) => ({ label: t(type), value: type }))} path={`schema-type-${breadcrumb.join('-')}-${String(key)}`} readOnly={locked || readOnly} value={childType} />
              {nested ? <span className="st-py-2 st-text-elevation-600">{Array.isArray(child) ? t('itemsCount', { count: String(child.length) }) : t('propertiesCount', { count: String(Object.keys(child as JsonObject).length) })}</span> : <ScalarEditor baseValue={childAt(baseValue, key)} locked={locked} onChange={(next) => replaceChild(key, next)} path={`seo-schema-value-${breadcrumb.join('-')}-${String(key)}`} readOnly={readOnly} value={child} variables={variables} />}
              <div className="st-flex st-h-full st-min-h-0 st-flex-nowrap st-items-center st-gap-1 st-whitespace-nowrap">
                <Button aria-label={t('moveUp')} buttonStyle="transparent" disabled={locked || readOnly || index === 0} margin={false} onClick={() => onChange(reorderSchemaEntry(value, index, index - 1))} size="xsmall" tooltip={t('moveUp')} type="button">↑</Button>
                <Button aria-label={t('moveDown')} buttonStyle="transparent" disabled={locked || readOnly || index === entries.length - 1} margin={false} onClick={() => onChange(reorderSchemaEntry(value, index, index + 1))} size="xsmall" tooltip={t('moveDown')} type="button">↓</Button>
                <Button aria-label={t('duplicate')} buttonStyle="transparent" disabled={locked || readOnly} margin={false} onClick={() => onChange(duplicateSchemaEntry(value, index))} size="xsmall" tooltip={t('duplicate')} type="button">⧉</Button>
                <Button aria-label={t('delete')} buttonStyle="transparent" className="!st-text-error-500 hover:!st-bg-error-100 hover:!st-text-error-700" disabled={locked || readOnly} margin={false} onClick={() => { if (globalThis.confirm(t('confirmDeleteProperty'))) onChange(removeSchemaEntry(value, index)) }} size="xsmall" tooltip={t('delete')} type="button">×</Button>
              </div>
            </div>
          </article>
          {nested ? <Collapsible className="st-ml-[25px]" header={t(childType === 'array' ? 'array' : 'object')} initCollapsed={false}>
            <ContainerEditor baseValue={childAt(baseValue, key)} breadcrumb={[...breadcrumb, String(key)]} locked={locked} onChange={(next) => replaceChild(key, next)} readOnly={readOnly} value={child as JsonObject | JsonValue[]} variables={variables} />
          </Collapsible> : null}
        </div>
      })}
    </div>
    {!locked && !readOnly ? <Popup button={`+ ${Array.isArray(value) ? t('addItem') : t('addProperty')}`} buttonClassName="btn btn--style-dashed btn--size-small btn--no-margin" buttonType="default" caret={false} render={({ close }) => <TypeMenu close={close} onChoose={add} />} size="fit-content" /> : locked ? <Banner>{t('structureInherited')}</Banner> : null}
  </div>
}

export const RecursiveSchemaEditor = ({ baseSchema, onChange, readOnly, schema, structuralLocked, variables }: {
  baseSchema?: JsonObject
  onChange: (schema: JsonObject) => void
  readOnly?: boolean
  schema: JsonObject
  structuralLocked?: boolean
  variables: SeoSchemaVariable[]
}) => <ContainerEditor baseValue={baseSchema} breadcrumb={[]} locked={structuralLocked} onChange={(value) => onChange(value as JsonObject)} readOnly={readOnly} value={schema} variables={variables} />
