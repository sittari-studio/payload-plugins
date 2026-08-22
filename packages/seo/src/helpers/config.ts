import type { SeoEnabledPluginConfig, SeoPayload } from '../types.js';

export const SEO_RUNTIME_CONFIG_KEY = '@sittari/payload-seo/config';

/** Gets the server-only plugin configuration retained on Payload's config object. */
export const getSeoRuntimeConfig = (
  payload: SeoPayload,
): SeoEnabledPluginConfig | undefined => {
  const value = payload.config?.custom?.[SEO_RUNTIME_CONFIG_KEY];
  return value !== null && typeof value === 'object'
    ? (value as SeoEnabledPluginConfig)
    : undefined;
};
