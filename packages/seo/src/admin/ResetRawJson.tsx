'use client'

import type { TextareaFieldClientProps } from 'payload'
import { Button, FieldError, FieldLabel, useField } from '@payloadcms/ui'

/** A focused raw-schema editor that can clear only the explicit JSON override. */
export const ResetRawJson = ({ field, path, readOnly }: TextareaFieldClientProps) => {
  const { errorMessage, setValue, showError, value } = useField<string>({ path })
  const label = typeof field.label === 'string' ? field.label : 'Raw JSON override'

  return <div className="field-type textarea">
    <FieldLabel label={label} path={path} required={field.required} />
    <textarea
      aria-label={label}
      disabled={readOnly}
      onChange={(event) => setValue(event.target.value)}
      rows={10}
      value={value ?? ''}
    />
    <Button buttonStyle="secondary" disabled={readOnly || !value} onClick={() => setValue('')} size="small" type="button">
      Clear raw JSON override
    </Button>
    {showError && <FieldError message={errorMessage} />}
  </div>
}
