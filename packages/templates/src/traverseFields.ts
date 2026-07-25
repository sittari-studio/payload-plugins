import type { Block, Field, Tab } from 'payload'

export type FieldTransformer = (field: Field) => Field

const transformTab = (tab: Tab, transformer: FieldTransformer): Tab => {
  const fields = transformFields(tab.fields, transformer)
  return fields === tab.fields ? tab : { ...tab, fields }
}

export const transformBlock = (
  block: Block,
  transformer: FieldTransformer,
): Block => {
  const fields = transformFields(block.fields, transformer)
  return fields === block.fields ? block : { ...block, fields }
}

export const transformField = (
  field: Field,
  transformer: FieldTransformer,
): Field => {
  let transformed = transformer(field)

  if ('fields' in transformed && Array.isArray(transformed.fields)) {
    const fields = transformFields(transformed.fields, transformer)
    if (fields !== transformed.fields) {
      transformed = { ...transformed, fields } as Field
    }
  }

  if (transformed.type === 'tabs') {
    const tabsField = transformed
    const tabs = tabsField.tabs.map((tab) => transformTab(tab, transformer))
    if (tabs.some((tab, index) => tab !== tabsField.tabs[index])) {
      transformed = {
        ...tabsField,
        tabs,
      }
    }
  }

  if (transformed.type === 'blocks') {
    const blocksField = transformed
    const blocks = blocksField.blocks.map((block) => transformBlock(block, transformer))
    const blockReferences = blocksField.blockReferences?.map((block) =>
      typeof block === 'string' ? block : transformBlock(block, transformer),
    )
    const blocksChanged = blocks.some((block, index) => block !== blocksField.blocks[index])
    const referencesChanged = blockReferences?.some(
      (block, index) => block !== blocksField.blockReferences?.[index],
    ) ?? false

    if (blocksChanged || referencesChanged) {
      transformed = {
        ...blocksField,
        blocks,
        blockReferences,
      }
    }
  }

  return transformed
}

export const transformFields = (
  fields: Field[],
  transformer: FieldTransformer,
): Field[] => {
  const transformed = fields.map((field) => transformField(field, transformer))
  return transformed.some((field, index) => field !== fields[index])
    ? transformed
    : fields
}

export const fieldsContain = (
  fields: Field[],
  predicate: (field: Field) => boolean,
): boolean => {
  let found = false

  transformFields(fields, (field) => {
    if (predicate(field)) {
      found = true
    }
    return field
  })

  return found
}
