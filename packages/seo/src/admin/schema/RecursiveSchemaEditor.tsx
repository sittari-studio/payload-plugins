'use client'

import { SelectInput } from '@payloadcms/ui'
import { useState } from 'react'

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

const ScalarEditor = ({ baseValue, locked, onChange, readOnly, value, variables }: {
  baseValue?: JsonValue
  locked?: boolean
  onChange: (value: JsonValue) => void
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
    {overridden || editingInherited ? <button className="st-h-full st-min-h-0 st-cursor-pointer st-rounded-sm st-border st-border-solid st-border-elevation-300 st-bg-elevation-100 st-px-2 st-text-[11px] st-font-semibold st-text-foreground hover:st-border-elevation-500 hover:st-bg-elevation-150 focus-visible:st-outline focus-visible:st-outline-2 focus-visible:st-outline-offset-2 focus-visible:st-outline-success-400 disabled:st-cursor-not-allowed disabled:st-opacity-40" disabled={readOnly} onClick={reset} type="button">{t('reset')}</button> : <><span>{t('inherited')}</span><button className="st-h-full st-min-h-0 st-cursor-pointer st-rounded-sm st-border st-border-solid st-border-elevation-300 st-bg-elevation-100 st-px-2 st-text-[11px] st-font-semibold st-text-foreground hover:st-border-elevation-500 hover:st-bg-elevation-150 focus-visible:st-outline focus-visible:st-outline-2 focus-visible:st-outline-offset-2 focus-visible:st-outline-success-400 disabled:st-cursor-not-allowed disabled:st-opacity-40" disabled={readOnly} onClick={() => setEditingInherited(true)} type="button">{t('overrideValue')}</button></>}
  </span> : null
  if (typeof value === 'boolean') return <div className="st-flex st-h-full st-min-h-0 st-min-w-0 st-items-stretch st-gap-1.5"><label className="st-inline-flex st-items-center st-gap-[7px] st-whitespace-nowrap"><input className="st-h-[18px] st-w-[18px] st-accent-success-500" checked={value} disabled={readOnly} onChange={(event) => onChange(event.target.checked)} type="checkbox" />{value ? t('true') : t('false')}</label>{controls}</div>
  if (typeof value === 'number') return <div className="st-flex st-h-full st-min-h-0 st-min-w-0 st-items-stretch st-gap-1.5"><input className="st-h-full st-min-h-0 st-w-full st-appearance-none st-box-border st-rounded-sm st-border st-border-solid st-border-elevation-150 st-bg-input st-px-base-50 st-font-body st-text-[inherit] st-leading-normal st-text-elevation-800 st-transition-[border-color,box-shadow] st-duration-100 hover:enabled:st-border-elevation-250 focus:st-border-elevation-400 focus:st-outline-none focus:st-shadow-focus disabled:st-cursor-not-allowed disabled:st-bg-elevation-50 disabled:st-text-elevation-450" disabled={readOnly} onChange={(event) => onChange(Number(event.target.value))} type="number" value={value} />{controls}</div>
  if (value === null) return <div className="st-flex st-h-full st-min-h-0 st-min-w-0 st-items-stretch st-gap-1.5"><span className="st-rounded-sm st-bg-elevation-100 st-px-3 st-py-2 st-font-mono">null</span>{controls}</div>
  return <div className="st-flex st-h-full st-min-h-0 st-min-w-0 st-items-stretch st-gap-1.5"><VariableInput disabled={readOnly} onChange={onChange} onFocus={() => setEditingInherited(true)} value={String(value)} variables={variables} />{controls}</div>
}

const TypeMenu = ({ onChoose }: { onChoose: (type: SchemaValueType) => void }) => {
  const t = useAdminText()
  return <div className="st-absolute st-left-0 st-top-[calc(100%+4px)] st-z-30 st-grid st-min-w-[180px] st-overflow-auto st-rounded-sm st-border st-border-solid st-border-elevation-200 st-bg-elevation-0 st-shadow-popover" role="menu">
    {TYPES.map((type) => <button className="st-cursor-pointer st-border-0 st-bg-transparent st-px-3 st-py-[9px] st-text-left hover:st-bg-elevation-100" key={type} onClick={() => onChoose(type)} role="menuitem" type="button">{t(type)}</button>)}
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
  const [adding, setAdding] = useState(false)
  const entries: Array<[number | string, JsonValue]> = Array.isArray(value) ? value.map((child, index) => [index, child]) : Object.entries(value)
  const replaceChild = (key: number | string, child: JsonValue) => {
    if (Array.isArray(value) && typeof key === 'number') { const copy = [...value]; copy[key] = child; onChange(copy) }
    else if (!Array.isArray(value) && typeof key === 'string') onChange({ ...value, [key]: child })
  }
  const add = (type: SchemaValueType) => {
    const child = createSchemaValue(type)
    onChange(Array.isArray(value) ? [...value, child] : { ...value, [uniquePropertyName(value)]: child })
    setAdding(false)
  }
  return <div className="st-grid st-gap-base-50">
    <div className="st-font-mono st-text-[11px] st-text-elevation-550" aria-label={t('breadcrumb')}>{breadcrumb.length ? breadcrumb.join(' › ') : t('schemaRoot')}</div>
    {!entries.length ? <div className="st-rounded-md st-border st-border-dashed st-border-elevation-250 st-bg-elevation-50 st-p-base st-text-center"><p>{Array.isArray(value) ? t('emptyArray') : t('emptyObject')}</p></div> : null}
    <div className="st-grid st-gap-base-40">
      {entries.map(([key, child], index) => {
        const childType = schemaValueType(child)
        const nested = childType === 'object' || childType === 'array'
        return <article className="st-h-14 st-max-h-14 st-min-h-14 st-overflow-visible st-box-border st-rounded-md st-border st-border-solid st-border-elevation-150 st-bg-elevation-0 st-p-1" key={`${String(key)}:${index}`}>
          <div className="st-grid st-h-full st-min-h-0 st-min-w-0 st-grid-cols-[minmax(0,.35fr)_minmax(0,.2fr)_minmax(0,1fr)_auto] st-items-stretch st-gap-2 [&>*]:st-min-h-0 [&>*]:st-min-w-0">
            {Array.isArray(value) ? <span className="st-p-2 st-font-mono st-text-elevation-600">{index + 1}</span> : <input aria-label={t('propertyName')} className="st-h-full st-min-h-0 st-w-full st-appearance-none st-box-border st-rounded-sm st-border st-border-solid st-border-elevation-150 st-bg-input st-px-base-50 st-font-body st-text-[inherit] st-leading-normal st-text-elevation-800 hover:enabled:st-border-elevation-250 focus:st-border-elevation-400 focus:st-outline-none focus:st-shadow-focus disabled:st-cursor-not-allowed disabled:st-bg-elevation-50 disabled:st-text-elevation-450" disabled={locked || readOnly} onBlur={(event) => onChange(renameSchemaProperty(value, String(key), event.target.value))} defaultValue={String(key)} />}
            <SelectInput className="st-h-full st-min-h-0 st-min-w-0 [&_.rs__control]:st-h-full [&_.rs__control]:st-max-h-full [&_.rs__control]:st-min-h-0" isClearable={false} name={`schema-type-${breadcrumb.join('-')}-${String(key)}`} onChange={(option) => { if (!Array.isArray(option) && typeof option?.value === 'string') replaceChild(key, createSchemaValue(option.value as SchemaValueType)) }} options={TYPES.map((type) => ({ label: t(type), value: type }))} path={`schema-type-${breadcrumb.join('-')}-${String(key)}`} readOnly={locked || readOnly} value={childType} />
            {nested ? <span className="st-py-2 st-text-elevation-600">{Array.isArray(child) ? t('itemsCount', { count: String(child.length) }) : t('propertiesCount', { count: String(Object.keys(child as JsonObject).length) })}</span> : <ScalarEditor baseValue={childAt(baseValue, key)} locked={locked} onChange={(next) => replaceChild(key, next)} readOnly={readOnly} value={child} variables={variables} />}
            <div className="st-flex st-h-full st-min-h-0 st-flex-nowrap st-items-center st-gap-1 st-whitespace-nowrap [&_button]:st-cursor-pointer [&_button]:st-rounded-sm [&_button]:st-border-0 [&_button]:st-bg-transparent [&_button]:st-px-2 [&_button]:st-py-1.5 [&_button]:st-text-foreground [&_button:hover]:st-bg-elevation-100 [&_button:disabled]:st-cursor-not-allowed [&_button:disabled]:st-opacity-35">
              <button aria-label={t('moveUp')} disabled={locked || readOnly || index === 0} onClick={() => onChange(reorderSchemaEntry(value, index, index - 1))} title={t('moveUp')} type="button">↑</button>
              <button aria-label={t('moveDown')} disabled={locked || readOnly || index === entries.length - 1} onClick={() => onChange(reorderSchemaEntry(value, index, index + 1))} title={t('moveDown')} type="button">↓</button>
              <button aria-label={t('duplicate')} disabled={locked || readOnly} onClick={() => onChange(duplicateSchemaEntry(value, index))} title={t('duplicate')} type="button">⧉</button>
              <button aria-label={t('delete')} className="!st-text-error-500" disabled={locked || readOnly} onClick={() => { if (globalThis.confirm(t('confirmDeleteProperty'))) onChange(removeSchemaEntry(value, index)) }} title={t('delete')} type="button">×</button>
            </div>
          </div>
          {nested ? <details className="st-ml-[25px] st-border-0 st-border-t st-border-solid st-border-elevation-100 st-px-2.5 st-pt-2 st-pb-2.5 [&>div]:st-border-0 [&>div]:st-border-l-2 [&>div]:st-border-solid [&>div]:st-border-elevation-150 [&>div]:st-pl-3" open>
            <summary className="st-mb-2 st-cursor-pointer st-text-xs st-font-semibold">{t(childType === 'array' ? 'array' : 'object')}</summary>
            <ContainerEditor baseValue={childAt(baseValue, key)} breadcrumb={[...breadcrumb, String(key)]} locked={locked} onChange={(next) => replaceChild(key, next)} readOnly={readOnly} value={child as JsonObject | JsonValue[]} variables={variables} />
          </details> : null}
        </article>
      })}
    </div>
    {!locked && !readOnly ? <div className="st-relative st-w-max">
      <button className="st-cursor-pointer st-rounded-sm st-border st-border-dashed st-border-elevation-300 st-bg-transparent st-px-3 st-py-2" onClick={() => setAdding((open) => !open)} type="button">+ {Array.isArray(value) ? t('addItem') : t('addProperty')}</button>
      {adding ? <TypeMenu onChoose={add} /> : null}
    </div> : locked ? <p className="st-rounded-sm st-bg-elevation-50 st-p-base-55 st-text-xs st-text-elevation-600">{t('structureInherited')}</p> : null}
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
