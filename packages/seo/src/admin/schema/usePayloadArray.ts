'use client'

import { useForm, useFormFields } from '@payloadcms/ui'
import { useCallback } from 'react'
import { payloadArrayRowState, type NestedArrayOptions } from './payloadArrayState.js'

export type PayloadArrayOptions = {
  nestedArrays?: NestedArrayOptions
  path: string
  schemaPath?: string
}

/**
 * Payload arrays are represented by a row count at the parent field and flattened
 * child paths. This adapter keeps custom managers on Payload's real form model.
 */
export const usePayloadArray = <Row extends object>({
  nestedArrays,
  path,
  schemaPath = path,
}: PayloadArrayOptions) => {
  const { addFieldRow, getDataByPath, moveFieldRow, removeFieldRow, replaceFieldRow } = useForm()

  // Subscribe only to this array's flattened state so unrelated Admin edits do not rerender it.
  useFormFields(([fields]) => JSON.stringify(Object.entries(fields).flatMap(([fieldPath, state]) =>
    fieldPath === path || fieldPath.startsWith(`${path}.`) ? [[fieldPath, state]] : [],
  )))
  const data = getDataByPath<unknown>(path)
  const rows = Array.isArray(data) ? data as Row[] : []

  const add = useCallback((row: Row, rowIndex?: number) => {
    addFieldRow({
      path,
      rowIndex,
      schemaPath,
      subFieldState: payloadArrayRowState(row as Record<string, unknown>, nestedArrays),
    })
  }, [addFieldRow, nestedArrays, path, schemaPath])

  const move = useCallback((moveFromIndex: number, moveToIndex: number) => {
    moveFieldRow({ moveFromIndex, moveToIndex, path })
  }, [moveFieldRow, path])

  const remove = useCallback((rowIndex: number) => {
    removeFieldRow({ path, rowIndex })
  }, [path, removeFieldRow])

  const replace = useCallback((rowIndex: number, row: Row) => {
    replaceFieldRow({
      path,
      rowIndex,
      schemaPath,
      subFieldState: payloadArrayRowState(row as Record<string, unknown>, nestedArrays),
    })
  }, [nestedArrays, path, replaceFieldRow, schemaPath])

  return { add, move, remove, replace, rows }
}
