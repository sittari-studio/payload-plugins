import type { Config } from 'payload'

export const extendOnInit = (
  incomingConfig: Config,
  onInit: NonNullable<Config['onInit']>,
): NonNullable<Config['onInit']> => {
  return async (payload) => {
    if (incomingConfig.onInit) {
      await incomingConfig.onInit(payload)
    }

    await onInit(payload)
  }
}

export const appendCollections = (
  incomingConfig: Config,
  collections: NonNullable<Config['collections']>,
): NonNullable<Config['collections']> => [
  ...(incomingConfig.collections ?? []),
  ...collections,
]

export const appendGlobals = (
  incomingConfig: Config,
  globals: NonNullable<Config['globals']>,
): NonNullable<Config['globals']> => [
  ...(incomingConfig.globals ?? []),
  ...globals,
]
