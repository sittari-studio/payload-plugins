export { stringsPlugin } from './plugin.js';
export {
  createTranslator,
  getStrings,
  getStringsRuntimeConfig,
  getTranslations,
  STRINGS_RUNTIME_CONFIG_KEY,
} from './helpers.js';
export type {
  GetStringsOptions,
  GetTranslationsOptions,
  LocalizedText,
  Strings,
  StringsPluginConfig,
  StringsRuntimeConfig,
  StringsScope,
  StringsScopes,
  StringsString,
  Translator,
} from './types.js';

export { stringsPlugin as default } from './plugin.js';
