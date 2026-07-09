export { seoPlugin } from './plugin.js'
export { loadDocumentWithoutFallback, loadSettingsWithoutFallback } from './utils/locale.js'
export { getByPath } from './resolvers/document.js'
export { resolveSeoMetadataCore } from './resolvers/metadata.js'
export { resolveSeoMetadata } from './helpers/metadata.js'
export { renderSchemaJsonLd } from './helpers/schema.js'
export { findSeoRedirect } from './helpers/redirects.js'
export { renderRobotsTxt } from './helpers/robots.js'
export { renderSitemapIndexXml, renderSitemapXml } from './helpers/sitemap.js'
export {
  DEFAULT_SEO_NAMES,
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
  SeoSocialMetadata,
  ResolvedSeoMetadata,
} from './types.js'
export type { SeoRedirect } from './helpers/redirects.js'

export { seoPlugin as default } from './plugin.js'
