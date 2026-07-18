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
  const controls = locked ? <span className="seo-schema-inheritance">
    {overridden || editingInherited ? <button disabled={readOnly} onClick={reset} type="button">{t('reset')}</button> : <><span>{t('inherited')}</span><button disabled={readOnly} onClick={() => setEditingInherited(true)} type="button">{t('overrideValue')}</button></>}
  </span> : null
  if (typeof value === 'boolean') return <div className="seo-schema-scalar"><label className="seo-schema-checkbox"><input checked={value} disabled={readOnly} onChange={(event) => onChange(event.target.checked)} type="checkbox" />{value ? t('true') : t('false')}</label>{controls}</div>
  if (typeof value === 'number') return <div className="seo-schema-scalar"><input className="seo-schema-number" disabled={readOnly} onChange={(event) => onChange(Number(event.target.value))} type="number" value={value} />{controls}</div>
  if (value === null) return <div className="seo-schema-scalar"><span className="seo-schema-null">null</span>{controls}</div>
  return <div className="seo-schema-scalar"><VariableInput disabled={readOnly} onChange={onChange} onFocus={() => setEditingInherited(true)} value={String(value)} variables={variables} />{controls}</div>
}

const TypeMenu = ({ onChoose }: { onChoose: (type: SchemaValueType) => void }) => {
  const t = useAdminText()
  return <div className="seo-schema-type-menu" role="menu">
    {TYPES.map((type) => <button key={type} onClick={() => onChoose(type)} role="menuitem" type="button">{t(type)}</button>)}
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
  return <div className="seo-schema-container">
    <div className="seo-schema-breadcrumb" aria-label={t('breadcrumb')}>{breadcrumb.length ? breadcrumb.join(' › ') : t('schemaRoot')}</div>
    {!entries.length ? <div className="seo-schema-empty"><p>{Array.isArray(value) ? t('emptyArray') : t('emptyObject')}</p></div> : null}
    <div className="seo-schema-tree">
      {entries.map(([key, child], index) => {
        const childType = schemaValueType(child)
        const nested = childType === 'object' || childType === 'array'
        return <article className="seo-schema-row" key={`${String(key)}:${index}`}>
          <div className="seo-schema-row__main">
            {Array.isArray(value) ? <span className="seo-schema-index">{index + 1}</span> : <input aria-label={t('propertyName')} className="seo-schema-key" disabled={locked || readOnly} onBlur={(event) => onChange(renameSchemaProperty(value, String(key), event.target.value))} defaultValue={String(key)} />}
            <SelectInput className="seo-schema-value-type" isClearable={false} name={`schema-type-${breadcrumb.join('-')}-${String(key)}`} onChange={(option) => { if (!Array.isArray(option) && typeof option?.value === 'string') replaceChild(key, createSchemaValue(option.value as SchemaValueType)) }} options={TYPES.map((type) => ({ label: t(type), value: type }))} path={`schema-type-${breadcrumb.join('-')}-${String(key)}`} readOnly={locked || readOnly} value={childType} />
            {nested ? <span className="seo-schema-nested-summary">{Array.isArray(child) ? t('itemsCount', { count: String(child.length) }) : t('propertiesCount', { count: String(Object.keys(child as JsonObject).length) })}</span> : <ScalarEditor baseValue={childAt(baseValue, key)} locked={locked} onChange={(next) => replaceChild(key, next)} readOnly={readOnly} value={child} variables={variables} />}
            <div className="seo-schema-row__actions">
              <button aria-label={t('moveUp')} disabled={locked || readOnly || index === 0} onClick={() => onChange(reorderSchemaEntry(value, index, index - 1))} title={t('moveUp')} type="button">↑</button>
              <button aria-label={t('moveDown')} disabled={locked || readOnly || index === entries.length - 1} onClick={() => onChange(reorderSchemaEntry(value, index, index + 1))} title={t('moveDown')} type="button">↓</button>
              <button aria-label={t('duplicate')} disabled={locked || readOnly} onClick={() => onChange(duplicateSchemaEntry(value, index))} title={t('duplicate')} type="button">⧉</button>
              <button aria-label={t('delete')} className="is-danger" disabled={locked || readOnly} onClick={() => { if (globalThis.confirm(t('confirmDeleteProperty'))) onChange(removeSchemaEntry(value, index)) }} title={t('delete')} type="button">×</button>
            </div>
          </div>
          {nested ? <details className="seo-schema-nested" open>
            <summary>{t(childType === 'array' ? 'array' : 'object')}</summary>
            <ContainerEditor baseValue={childAt(baseValue, key)} breadcrumb={[...breadcrumb, String(key)]} locked={locked} onChange={(next) => replaceChild(key, next)} readOnly={readOnly} value={child as JsonObject | JsonValue[]} variables={variables} />
          </details> : null}
        </article>
      })}
    </div>
    {!locked && !readOnly ? <div className="seo-schema-add-wrap">
      <button className="seo-schema-add" onClick={() => setAdding((open) => !open)} type="button">+ {Array.isArray(value) ? t('addItem') : t('addProperty')}</button>
      {adding ? <TypeMenu onChoose={add} /> : null}
    </div> : locked ? <p className="seo-schema-locked-note">{t('structureInherited')}</p> : null}
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
