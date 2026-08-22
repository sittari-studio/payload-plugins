export { seoPlugin } from './plugin.js';
export {
  loadDocumentWithoutFallback,
  loadSettingsWithoutFallback,
} from './utils/locale.js';
export { getByPath } from './resolvers/document.js';
export {
  applyJsonPatch,
  containsReservedSchemaKey,
  parseJsonPointer,
  validateJsonPatch,
  validateSchemaJson,
  validateSchemaObject,
} from './schema/json.js';
export {
  composeSchemaGraph,
  resolveSchemaList,
  resolveSchemaTemplate,
} from './schema/resolve.js';
export { createSchemaStarter, SEO_SCHEMA_STARTERS } from './schema/starters.js';
export {
  createSchemaValue,
  diffEffectiveSchema,
  duplicateSchemaEntry,
  escapeJsonPointerSegment,
  hasSameSchemaStructure,
  insertVariableAtCaret,
  parseSchemaImport,
  removeManagedContext,
  removeSchemaEntry,
  renameSchemaProperty,
  reorderSchemaEntry,
  schemaValueType,
  setSchemaValueAtPath,
  uniquePropertyName,
} from './schema/editor.js';
export {
  discoverSchemaVariables,
  groupSchemaVariables,
  substituteSchemaVariables,
} from './schema/variables.js';
export { resolveSeoMetadataCore } from './resolvers/metadata.js';
export {
  resolveCanonical,
  resolveCanonicalRobotsSeo,
  resolveEffectiveRobots,
  resolveEffectiveSeo,
  isPublicSeoDocument,
  projectSeoPreview,
  resolveSitemapEligibility,
  resolveSocialMetadata,
  resolveStructuredData,
} from './resolvers/effective.js';
export { resolveSeoMetadata } from './helpers/metadata.js';
export { resolveSeoPreview } from './helpers/preview.js';
export { renderSchemaJsonLd, serializeJsonLd } from './helpers/schema.js';
export { findSeoRedirect } from './helpers/redirects.js';
export { renderRobotsTxt } from './helpers/robots.js';
export { renderSitemapIndexXml, renderSitemapXml } from './helpers/sitemap.js';
export {
  DEFAULT_SEO_NAMES,
  SEO_PREVIEWS_ADMIN_COMPONENT,
  SEO_DOCUMENT_SCHEMA_MANAGER_ADMIN_COMPONENT,
  SEO_SETTINGS_SCHEMA_MANAGER_ADMIN_COMPONENT,
  SEO_PLUGIN_MARKER,
} from './types.js';
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
  SeoSitemapConfig,
  SeoPayload,
  SeoLocalApiOptions,
  SeoRobotsDirectives,
  RobotsMode,
  CanonicalMode,
  TrailingSlashPolicy,
  SeoSocialMetadata,
  ResolvedEffectiveSeo,
  ResolvedSitemapSeo,
  SeoPreview,
  ResolvedSeoMetadata,
} from './types.js';
export type {
  JsonObject,
  JsonValue,
  SeoCollectionSchemaTemplates,
  SeoDocumentSchema,
  SeoGlobalSchemaOverride,
  SeoJsonPatchOperation,
  SeoSchemaInstance,
  SeoSchemaTemplate,
  SeoSchemaVariable,
} from './schema/types.js';
export type { SeoRedirect } from './helpers/redirects.js';

export { seoPlugin as default } from './plugin.js';
