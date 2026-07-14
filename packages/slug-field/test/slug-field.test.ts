import type { Field } from 'payload'
import { describe, expect, it } from 'vitest'

import { createSlugField } from '../src/index.js'

const getNamedField = (fields: Field[], name: string) =>
  fields.find((field) => 'name' in field && field.name === name)

describe('createSlugField', () => {
  it('creates a localized, required slug row without an instruction by default', () => {
    const field = createSlugField()

    expect(field).toMatchObject({ type: 'row', admin: { position: 'sidebar' } })
    expect(getNamedField(field.fields, 'slug')).toMatchObject({ required: true, localized: true, label: { en: 'Slug', ru: 'Слаг', uk: 'Слаг' } })
    expect(getNamedField(field.fields, 'slugInstruction')).toBeUndefined()
  })

  it('adds locale-keyed instruction text only when configured', () => {
    const field = createSlugField({ instruction: { en: 'Use home for the front page.', uk: 'Для головної сторінки використовуйте home.' } })

    expect(getNamedField(field.fields, 'slugInstruction')).toMatchObject({
      type: 'ui',
      admin: { custom: { slugField: { instruction: { en: 'Use home for the front page.' } } } },
    })
  })

  it('allows the completed row to be overridden', () => {
    const field = createSlugField({ useAsSlug: 'name', localized: false, overrides: (defaultSlugField) => ({ ...defaultSlugField, admin: { position: 'sidebar' } }) })

    expect(field.admin?.position).toBe('sidebar')
    expect(getNamedField(field.fields, 'slug')).toMatchObject({ localized: false })
  })
})
