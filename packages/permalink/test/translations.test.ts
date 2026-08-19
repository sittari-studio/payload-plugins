import { describe, expect, it } from 'vitest'

import { translatePathValidationMessage } from '../src/translations.js'

describe('path-field validation translations', () => {
  it('localizes permalink errors by admin language', () => {
    expect(
      translatePathValidationMessage('This permalink is already in use.', 'uk-UA'),
    ).toBe('Це постійне посилання вже використовується.')
    expect(
      translatePathValidationMessage('This permalink is already in use.', 'ru-RU'),
    ).toBe('Эта постоянная ссылка уже используется.')
  })

  it('falls back to English and preserves unknown messages', () => {
    expect(
      translatePathValidationMessage('This permalink is already in use.', 'de-DE'),
    ).toBe('This permalink is already in use.')
    expect(translatePathValidationMessage('Unknown validation message', 'uk')).toBe(
      'Unknown validation message',
    )
  })
})
