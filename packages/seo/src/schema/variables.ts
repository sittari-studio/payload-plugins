import type { Field } from 'payload'
import { getByPath } from '../resolvers/document.js'
import type { JsonObject, JsonValue, SeoSchemaVariable } from './types.js'

const MISSING = Symbol('missing schema variable')
const labelText = (label: unknown, fallback: string): string => typeof label === 'string' ? label : fallback
const excluded = (path: string, prefixes: readonly string[]): boolean => prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}.`))

export const discoverSchemaVariables = ({
  collection, fields, exclusions = [], generatedSeoField = 'seo',
}: { collection: string; fields: Field[]; exclusions?: readonly string[]; generatedSeoField?: string }): SeoSchemaVariable[] => {
  const prefixes = [generatedSeoField, ...exclusions]
  const result: SeoSchemaVariable[] = []
  const visit = (items: Field[], parent = ''): void => {
    for (const field of items) {
      if (field.type === 'ui' || field.type === 'blocks') continue
      if (field.type === 'tabs') {
        for (const tab of field.tabs) visit(tab.fields, 'name' in tab && tab.name ? (parent ? `${parent}.${tab.name}` : tab.name) : parent)
        continue
      }
      if (field.type === 'row' || field.type === 'collapsible') {
        visit(field.fields, parent)
        continue
      }
      if (!('name' in field)) continue
      const path = parent ? `${parent}.${field.name}` : field.name
      if (excluded(path, prefixes)) continue
      if (field.type !== 'group') {
        result.push({ collection, path, label: labelText(field.label, field.name) })
      }
      if (field.type === 'group') visit(field.fields, path)
    }
  }
  visit(fields)
  return result
}

export const groupSchemaVariables = (collections: Record<string, SeoSchemaVariable[]>): SeoSchemaVariable[] => {
  const collectionCount = Object.keys(collections).length
  const occurrences = new Map<string, number>()
  for (const variables of Object.values(collections)) for (const path of new Set(variables.map((item) => item.path))) occurrences.set(path, (occurrences.get(path) ?? 0) + 1)
  return Object.values(collections).flat().map((item) => ({ ...item, availableInEveryCollection: occurrences.get(item.path) === collectionCount }))
}

const stringify = (value: unknown): string => value !== null && typeof value === 'object' ? JSON.stringify(value) : String(value)

const resolveString = (value: string, document: Record<string, unknown>): unknown | typeof MISSING => {
  const sentinel = '\u0000DOLLAR\u0000'
  const escaped = value.replace(/\$\$/g, sentinel)
  const exact = escaped.match(/^\$([A-Za-z0-9_.-]+)$/)
  if (exact) {
    const native = getByPath(document, exact[1])
    return native === undefined ? MISSING : native
  }
  let missing = false
  const resolved = escaped.replace(/\$([A-Za-z0-9_.-]+)/g, (_, path: string) => {
    const native = getByPath(document, path)
    if (native === undefined) { missing = true; return '' }
    return stringify(native)
  })
  return missing ? MISSING : resolved.replaceAll(sentinel, '$')
}

export const substituteSchemaVariables = (value: unknown, document: Record<string, unknown>): unknown => {
  const visit = (current: unknown): unknown | typeof MISSING => {
    if (typeof current === 'string') return resolveString(current, document)
    if (Array.isArray(current)) return current.flatMap((item) => { const resolved = visit(item); return resolved === MISSING ? [] : [resolved] })
    if (current && typeof current === 'object') {
      const output: JsonObject = {}
      for (const [key, child] of Object.entries(current)) {
        const resolved = visit(child)
        if (resolved !== MISSING) output[key] = resolved as JsonValue
      }
      return output
    }
    return current
  }
  const result = visit(value)
  return result === MISSING ? undefined : result
}
