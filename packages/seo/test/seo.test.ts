import type { Config } from 'payload'
import { describe, expect, it } from 'vitest'

import { seoPlugin } from '../src/index.js'

describe('seoPlugin', () => {
  it('returns the incoming config when enabled', () => {
    const inputConfig = {
      collections: [],
    } as unknown as Config

    const outputConfig = seoPlugin()(inputConfig)

    expect(outputConfig).toEqual(inputConfig)
  })

  it('returns the incoming config when disabled', () => {
    const inputConfig = {
      collections: [],
    } as unknown as Config

    const outputConfig = seoPlugin({ enabled: false })(inputConfig)

    expect(outputConfig).toEqual(inputConfig)
  })
})
