import type {
  ResolvedSeoMetadata,
  SeoDocument,
  SeoEnabledPluginConfig,
  SeoPluginConfig,
} from '../types.js';
import { resolveEffectiveSeo } from './effective.js';
import { composeSchemaGraph } from '../schema/resolve.js';

type ResolverOptions = {
  collection: string;
  config: SeoEnabledPluginConfig;
  document: SeoDocument;
  locale: string;
  names?: SeoPluginConfig['names'];
  settings: SeoDocument;
};

/** Framework-neutral projection of the shared effective SEO state. */
export const projectSeoMetadata = (
  effective: Awaited<ReturnType<typeof resolveEffectiveSeo>>,
): ResolvedSeoMetadata => {
  const result: ResolvedSeoMetadata = {};
  if (effective.title) result.title = effective.title;
  if (effective.description) result.description = effective.description;
  if (effective.keywords) result.keywords = effective.keywords;
  if (effective.canonical.url) result.canonicalUrl = effective.canonical.url;
  result.robots = {
    index: effective.robots.index,
    follow: effective.robots.follow,
    ...(effective.robots.custom?.length
      ? { custom: effective.robots.custom }
      : {}),
  };
  if (Object.keys(effective.social.openGraph).length)
    result.openGraph = effective.social.openGraph;
  if (Object.keys(effective.social.twitter).length)
    result.twitter = effective.social.twitter;
  if (effective.schemas.length)
    result.schema = composeSchemaGraph(effective.schemas);
  return result;
};

export const resolveSeoMetadataCore = async (
  input: ResolverOptions,
): Promise<ResolvedSeoMetadata> =>
  projectSeoMetadata(await resolveEffectiveSeo(input));
