export { seoPlugin } from './plugin.js'
export { loadDocumentWithoutFallback, loadSettingsWithoutFallback } from './utils/locale.js'
export { getByPath } from './resolvers/document.js'
export { resolveSeoMetadataCore } from './resolvers/metadata.js'
export {
  resolveCanonical,
  resolveEffectiveRobots,
  resolveEffectiveSeo,
  projectSeoPreview,
  resolveSitemapEligibility,
  resolveSocialMetadata,
  resolveStructuredData,
} from './resolvers/effective.js'
export { resolveSeoMetadata } from './helpers/metadata.js'
export { resolveSeoPreview } from './helpers/preview.js'
export { renderSchemaJsonLd, serializeJsonLd } from './helpers/schema.js'
export { findSeoRedirect } from './helpers/redirects.js'
export { renderRobotsTxt } from './helpers/robots.js'
export { renderSitemapIndexXml, renderSitemapXml } from './helpers/sitemap.js'
export {
  DEFAULT_SEO_NAMES,
  SEO_PREVIEWS_ADMIN_COMPONENT,
  SEO_RAW_JSON_ADMIN_COMPONENT,
  SEO_SCHEMA_VALUE_OVERRIDES_ADMIN_COMPONENT,
  SEO_PLUGIN_MARKER,
} from './types.js'
export type {
  ResolveDocumentUrl,
  ResolveLastModified,
  ResolveMediaUrl,
  ResolveRobotsSitemapUrls,
  ResolveSitemapChunkUrl,
  SeoAdminCustom,
  SeoCollectionConfig,
  SeoDocument,
  SeoDiagnostic,
  SeoDocumentFieldMappings,
  SeoDisabledPluginConfig,
  SeoEnabledPluginConfig,
  SeoGeneratedNames,
  SeoPluginAccess,
  SeoPluginConfig,
  SeoSchemaType,
  SeoSitemapConfig,
  SeoPayload,
  SeoRobotsDirectives,
  RobotsMode,
  CanonicalMode,
  TrailingSlashPolicy,
  SeoSocialMetadata,
  ResolvedEffectiveSeo,
  SeoPreview,
  ResolvedSeoMetadata,
} from './types.js'
export type { SeoRedirect } from './helpers/redirects.js'

export { seoPlugin as default } from './plugin.js'
