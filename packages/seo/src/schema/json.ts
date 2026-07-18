import type { JsonObject, JsonValue, SeoJsonPatchOperation } from './types.js'

export const isJsonObject = (value: unknown): value is JsonObject =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const decode = (segment: string): string => segment.replace(/~1/g, '/').replace(/~0/g, '~')

export const parseJsonPointer = (pointer: string): string[] | null => {
  if (pointer === '') return []
  if (!pointer.startsWith('/')) return null
  return pointer.slice(1).split('/').map(decode)
}

export const containsReservedSchemaKey = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.some(containsReservedSchemaKey)
  if (!isJsonObject(value)) return false
  return Object.entries(value).some(([key, child]) => key === '@context' || containsReservedSchemaKey(child))
}

export const validateSchemaObject = (value: unknown): true | string => {
  if (!isJsonObject(value)) return 'Schema JSON must have an object at its root.'
  if (containsReservedSchemaKey(value)) return 'Schema JSON must not contain the reserved @context key.'
  return true
}

export const validateSchemaJson = (value: unknown): true | string => {
  if (value === undefined || value === null || value === '') return true
  if (typeof value !== 'string') return 'Enter valid JSON.'
  try {
    return validateSchemaObject(JSON.parse(value))
  } catch {
    return 'Enter valid JSON.'
  }
}

const scalarType = (value: unknown): 'boolean' | 'null' | 'number' | 'string' | undefined => {
  if (value === null) return 'null'
  return ['boolean', 'number', 'string'].includes(typeof value) ? typeof value as 'boolean' | 'number' | 'string' : undefined
}

const valueAtPointer = (source: JsonObject, segments: string[]): { exists: boolean; value?: unknown } => {
  let current: unknown = source
  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = /^(0|[1-9]\d*)$/.test(segment) ? Number(segment) : -1
      if (index < 0 || index >= current.length) return { exists: false }
      current = current[index]
    } else if (isJsonObject(current) && Object.hasOwn(current, segment)) current = current[segment]
    else return { exists: false }
  }
  return { exists: true, value: current }
}

export const validateJsonPatch = (value: unknown, options: { scalarValuesOnly?: boolean; source?: JsonObject } = {}): true | string => {
  if (value === undefined || value === null) return true
  if (!Array.isArray(value)) return 'Schema overrides must be a JSON Patch array.'
  for (const operation of value) {
    if (!isJsonObject(operation) || !['add', 'replace', 'remove'].includes(String(operation.op))) return 'Only add, replace, and remove patch operations are supported.'
    const segments = typeof operation.path === 'string' ? parseJsonPointer(operation.path) : null
    if (!segments) return 'Every patch operation requires a valid JSON Pointer path.'
    if (segments.includes('@context')) return 'Schema overrides must not target the reserved @context key.'
    if (operation.op !== 'remove' && !Object.hasOwn(operation, 'value')) return 'Add and replace patch operations require a value.'
    if (operation.op !== 'remove' && containsReservedSchemaKey(operation.value)) return 'Schema overrides must not add the reserved @context key.'
    if (options.scalarValuesOnly) {
      if (operation.op !== 'replace') return 'Localized template overrides may only replace existing scalar values.'
      const replacementType = scalarType(operation.value)
      if (!replacementType) return 'Localized template overrides may only replace existing scalar values.'
      if (options.source) {
        const target = valueAtPointer(options.source, segments)
        if (!target.exists || scalarType(target.value) !== replacementType) return 'Localized template overrides must preserve the type of an existing scalar value.'
      }
    }
  }
  return true
}

const arrayIndex = (segment: string, length: number, allowAppend: boolean): number | null => {
  if (allowAppend && segment === '-') return length
  if (!/^(0|[1-9]\d*)$/.test(segment)) return null
  const index = Number(segment)
  return index <= length ? index : null
}

/** Immutable RFC 6902-style add/replace/remove application. Invalid operations are rejected. */
export const applyJsonPatch = (source: JsonObject, patch: readonly SeoJsonPatchOperation[] = []): JsonObject => {
  const validation = validateJsonPatch(patch)
  if (validation !== true) throw new Error(validation)
  let result: unknown = structuredClone(source)
  for (const operation of patch) {
    const segments = parseJsonPointer(operation.path)!
    if (!segments.length) {
      if (operation.op === 'remove') throw new Error('The schema root cannot be removed.')
      if (!isJsonObject(operation.value)) throw new Error('The schema root must remain an object.')
      result = structuredClone(operation.value)
      continue
    }
    let parent: unknown = result
    for (const segment of segments.slice(0, -1)) {
      if (Array.isArray(parent)) {
        const index = arrayIndex(segment, parent.length - 1, false)
        if (index === null || parent[index] === undefined) throw new Error(`Patch path does not exist: ${operation.path}`)
        parent = parent[index]
      } else if (isJsonObject(parent) && Object.hasOwn(parent, segment)) parent = parent[segment]
      else throw new Error(`Patch path does not exist: ${operation.path}`)
    }
    const key = segments.at(-1)!
    if (Array.isArray(parent)) {
      const index = arrayIndex(key, parent.length, operation.op === 'add')
      if (index === null || (operation.op !== 'add' && index >= parent.length)) throw new Error(`Patch path does not exist: ${operation.path}`)
      if (operation.op === 'add') parent.splice(index, 0, structuredClone(operation.value))
      else if (operation.op === 'replace') parent[index] = structuredClone(operation.value)
      else parent.splice(index, 1)
    } else if (isJsonObject(parent)) {
      if (operation.op !== 'add' && !Object.hasOwn(parent, key)) throw new Error(`Patch path does not exist: ${operation.path}`)
      if (operation.op === 'remove') delete parent[key]
      else parent[key] = structuredClone(operation.value) as JsonValue
    } else throw new Error(`Patch path does not exist: ${operation.path}`)
  }
  if (!isJsonObject(result)) throw new Error('The schema root must remain an object.')
  return result
}
