'use client'

import { useMemo, useRef, useState } from 'react'

import { insertVariableAtCaret } from '../../schema/editor.js'
import type { SeoSchemaVariable } from '../../schema/types.js'
import { useAdminText } from '../use-admin-text.js'

export const VariableInput = ({ disabled, onChange, onFocus, value, variables }: {
  disabled?: boolean
  onChange: (value: string) => void
  onFocus?: () => void
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

  return <div className="st-relative st-h-full st-min-w-0 st-flex-1">
    <input
      aria-autocomplete="list"
      aria-controls={matches.length ? 'seo-schema-variable-list' : undefined}
      aria-expanded={matches.length > 0}
      className="st-h-full st-min-h-0 st-w-full st-appearance-none st-box-border st-rounded-sm st-border st-border-solid st-border-elevation-150 st-bg-input st-px-base-50 st-font-body st-text-[inherit] st-leading-normal st-text-elevation-800 st-transition-[border-color,box-shadow] st-duration-100 hover:enabled:st-border-elevation-250 focus:st-border-elevation-400 focus:st-outline-none focus:st-shadow-focus disabled:st-cursor-not-allowed disabled:st-bg-elevation-50 disabled:st-text-elevation-450"
      disabled={disabled}
      onChange={(event) => { onChange(event.target.value); updateQuery(event.target) }}
      onClick={(event) => updateQuery(event.currentTarget)}
      onFocus={(event) => { onFocus?.(); updateQuery(event.currentTarget) }}
      onKeyDown={(event) => {
        if (!matches.length) return
        if (event.key === 'ArrowDown') { event.preventDefault(); setActive((index) => (index + 1) % matches.length) }
        else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((index) => (index - 1 + matches.length) % matches.length) }
        else if (event.key === 'Enter') { event.preventDefault(); choose(matches[active]) }
        else if (event.key === 'Escape') { event.preventDefault(); setQuery(undefined) }
      }}
      ref={inputRef}
      role="combobox"
      value={value}
    />
    {matches.length ? <div className="st-absolute st-left-0 st-right-0 st-top-[calc(100%+4px)] st-z-30 st-grid st-max-h-[260px] st-min-w-[180px] st-overflow-auto st-rounded-sm st-border st-border-solid st-border-elevation-200 st-bg-elevation-0 st-shadow-popover" id="seo-schema-variable-list" role="listbox">
      {matches.map((variable, index) => <button aria-selected={index === active} className={`st-grid st-cursor-pointer st-gap-0.5 st-border-0 st-bg-transparent st-px-2.5 st-py-2 st-text-left ${index === active ? 'st-bg-elevation-100' : ''}`} key={`${variable.collection}:${variable.path}`} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(variable)} role="option" type="button">
        <span>{variable.label}</span><code className="st-text-[11px] st-text-blue-600">${variable.path}</code><small className="st-text-elevation-500">{variable.collection}{variable.availableInEveryCollection === false ? ` · ${t('notEveryCollection')}` : ''}</small>
      </button>)}
    </div> : null}
  </div>
}
