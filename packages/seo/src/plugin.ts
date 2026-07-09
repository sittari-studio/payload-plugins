import type { Config, Plugin } from 'payload'

import type { SeoPluginConfig } from './types.js'

export const seoPlugin =
  (pluginConfig: SeoPluginConfig = {}): Plugin =>
  (incomingConfig: Config): Config => {
    const { enabled = true } = pluginConfig

    if (!enabled) {
      return incomingConfig
    }

    return {
      ...incomingConfig,
    }
  }

export default seoPlugin
