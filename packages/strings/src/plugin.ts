import type { Config, Plugin } from 'payload';

import { STRINGS_RUNTIME_CONFIG_KEY } from './helpers.js';
import { createStringsGlobal } from './globals/strings.js';
import type { StringsPluginConfig } from './types.js';

export const stringsPlugin =
  (pluginConfig: StringsPluginConfig = {}): Plugin =>
  (incomingConfig: Config): Config => {
    const { enabled = true, slug = 'strings' } = pluginConfig;

    if (!enabled) {
      return incomingConfig;
    }

    const localization = incomingConfig.localization;

    if (!localization) {
      throw new Error(
        'stringsPlugin requires Payload localization to be configured. Add `localization` to your Payload config or disable the plugin with `{ enabled: false }`.',
      );
    }

    if (!localization.locales?.length) {
      throw new Error(
        'stringsPlugin requires at least one locale in the Payload localization config.',
      );
    }

    const scopes = pluginConfig.scopes ?? {};

    if (Object.keys(scopes).length === 0) {
      throw new Error(
        'stringsPlugin requires at least one scope. Define scopes such as `general`, `auth`, or `errors`.',
      );
    }

    for (const [name, scope] of Object.entries(scopes)) {
      if (!scope.strings || Object.keys(scope.strings).length === 0) {
        throw new Error(
          `stringsPlugin scope "${name}" must define at least one string.`,
        );
      }
    }

    const defaultGlobal = createStringsGlobal({
      scopes,
      slug,
    });

    const stringsGlobal = pluginConfig.overrides
      ? pluginConfig.overrides(defaultGlobal)
      : defaultGlobal;

    return {
      ...incomingConfig,
      custom: {
        ...incomingConfig.custom,
        [STRINGS_RUNTIME_CONFIG_KEY]: { scopes, slug },
      },
      globals: [
        ...(incomingConfig.globals ?? []),
        ...((incomingConfig.globals ?? []).some(
          (global) => global.slug === slug,
        )
          ? []
          : [stringsGlobal]),
      ],
    };
  };

export default stringsPlugin;
