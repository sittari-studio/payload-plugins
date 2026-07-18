'use client'

import { Button, TextInput } from '@payloadcms/ui'
import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent, RefObject } from 'react'

import { insertVariableAtCaret } from '../../schema/editor.js'
import type { SeoSchemaVariable } from '../../schema/types.js'
import { useAdminText } from '../use-admin-text.js'

export const VariableInput = ({ disabled, onChange, onFocus, path, value, variables }: {
  disabled?: boolean
  onChange: (value: string) => void
  onFocus?: () => void
  path: string
  value: string
  variables: SeoSchemaVariable[]
}) => {
  const t = useAdminText()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState<string>()
  const [active, setActive] = useState(0)
  const matches = useMemo(() => {
    if (query === undefined) return []
    const normalized = query.toLowerCase()
    return variables.filter((variable) => `${variable.path} ${variable.label} ${variable.collection}`.toLowerCase().includes(normalized)).slice(0, 12)
  }, [query, variables])

  const updateQuery = (input: HTMLInputElement) => {
    const before = input.value.slice(0, input.selectionStart ?? input.value.length)
    const token = before.match(/\$([A-Za-z0-9_.]*)$/)
    setQuery(token?.[1])
    setActive(0)
  }

  const choose = (variable: SeoSchemaVariable) => {
    const input = inputRef.current
    if (!input) return
    const result = insertVariableAtCaret(value, variable.path, input.selectionStart ?? value.length, input.selectionEnd ?? input.selectionStart ?? value.length)
    onChange(result.value)
    setQuery(undefined)
    requestAnimationFrame(() => {
      input.focus()
      input.setSelectionRange(result.caret, result.caret)
    })
  }

  return <div
      aria-autocomplete="list"
      aria-controls={matches.length ? 'seo-schema-variable-list' : undefined}
      aria-expanded={matches.length > 0}
      className="seo-schema-compact-field st-relative st-h-full st-min-w-0 st-flex-1"
      onBlur={(event) => { if (event.target instanceof HTMLInputElement) setQuery(undefined) }}
      onClick={(event) => { if (event.target instanceof HTMLInputElement) updateQuery(event.target) }}
      onFocus={(event) => { if (event.target instanceof HTMLInputElement) { onFocus?.(); updateQuery(event.target) } }}
      role="combobox"
    >
    <TextInput
      inputRef={inputRef as RefObject<HTMLInputElement>}
      onChange={(event: ChangeEvent<HTMLInputElement>) => { onChange(event.target.value); updateQuery(event.target) }}
      onKeyDown={(event) => {
        if (!matches.length) return
        if (event.key === 'ArrowDown') { event.preventDefault(); setActive((index) => (index + 1) % matches.length) }
        else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((index) => (index - 1 + matches.length) % matches.length) }
        else if (event.key === 'Enter') { event.preventDefault(); choose(matches[active]) }
        else if (event.key === 'Escape') { event.preventDefault(); setQuery(undefined) }
      }}
      path={path}
      readOnly={disabled}
      value={value}
    />
    {matches.length ? <div className="st-absolute st-left-0 st-right-0 st-top-[calc(100%+4px)] st-z-30 st-grid st-max-h-[260px] st-min-w-[180px] st-overflow-auto st-rounded-sm st-border st-border-solid st-border-elevation-200 st-bg-elevation-0 st-shadow-popover" id="seo-schema-variable-list" role="listbox">
      {matches.map((variable, index) => <Button buttonStyle={index === active ? 'tab' : 'transparent'} className="seo-variable-option st-w-full st-px-2.5 st-py-2 st-text-left" extraButtonProps={{ 'aria-selected': index === active, role: 'option' }} key={`${variable.collection}:${variable.path}`} margin={false} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(variable)} size="small" type="button">
        <span className="st-grid st-gap-0.5"><span>{variable.label}</span><code className="st-text-[11px] st-text-blue-600">${variable.path}</code><small className="st-text-elevation-500">{variable.collection}{variable.availableInEveryCollection === false ? ` · ${t('notEveryCollection')}` : ''}</small></span>
      </Button>)}
    </div> : null}
  </div>
}
