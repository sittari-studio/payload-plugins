import type { SeoDocument } from '../types.js';
import { applyJsonPatch, isJsonObject, validateSchemaObject } from './json.js';
import { substituteSchemaVariables } from './variables.js';
import type {
  JsonObject,
  SeoDocumentSchema,
  SeoGlobalSchemaOverride,
  SeoSchemaInstance,
  SeoSchemaTemplate,
} from './types.js';

export const resolveSchemaTemplate = ({
  template,
  document,
  overrides,
  canonicalUrl,
}: {
  template: SeoSchemaTemplate;
  document: SeoDocument;
  overrides?: SeoSchemaInstance['overrides'];
  canonicalUrl?: string;
}): JsonObject => {
  if (validateSchemaObject(template.schema) !== true)
    throw new Error(`Invalid schema template: ${template.id}`);
  const localized = applyJsonPatch(template.schema, template.valueOverrides);
  const patched = applyJsonPatch(localized, overrides);
  const substituted = substituteSchemaVariables(patched, {
    ...document,
    canonicalUrl,
  });
  const result = isJsonObject(substituted) ? substituted : {};
  return result;
};

export const resolveSchemaList = ({
  globalSchemas = [],
  globalOverrides = [],
  templates = [],
  instances = [],
  documentSchemas = [],
  document,
  canonicalUrl,
  onError,
}: {
  globalSchemas?: SeoSchemaTemplate[];
  globalOverrides?: SeoGlobalSchemaOverride[];
  templates?: SeoSchemaTemplate[];
  instances?: SeoSchemaInstance[];
  documentSchemas?: SeoDocumentSchema[];
  document: SeoDocument;
  canonicalUrl?: string;
  onError?: (failure: {
    id: string;
    scope: 'collection' | 'document' | 'global';
    reason: 'invalid' | 'missing';
  }) => void;
}): JsonObject[] => {
  const overridesByGlobal = new Map(
    globalOverrides.map((item) => [item.schemaId, item.overrides]),
  );
  const byId = new Map(templates.map((template) => [template.id, template]));
  return [
    ...globalSchemas.flatMap((template) => {
      try {
        return [
          resolveSchemaTemplate({
            template,
            document,
            overrides: overridesByGlobal.get(template.id),
            canonicalUrl,
          }),
        ];
      } catch {
        onError?.({ id: template.id, scope: 'global', reason: 'invalid' });
        return [];
      }
    }),
    ...instances.flatMap((instance) => {
      const template = byId.get(instance.templateId);
      if (!template) {
        onError?.({
          id: instance.templateId,
          scope: 'collection',
          reason: 'missing',
        });
        return [];
      }
      try {
        return [
          resolveSchemaTemplate({
            template,
            document,
            overrides: instance.overrides,
            canonicalUrl,
          }),
        ];
      } catch {
        onError?.({
          id: instance.templateId,
          scope: 'collection',
          reason: 'invalid',
        });
        return [];
      }
    }),
    ...documentSchemas.flatMap((item) => {
      try {
        return [
          resolveSchemaTemplate({
            template: {
              id: item.schemaId,
              name: item.name,
              schema: item.schema,
              valueOverrides: item.valueOverrides,
            },
            document,
            canonicalUrl,
          }),
        ];
      } catch {
        onError?.({ id: item.schemaId, scope: 'document', reason: 'invalid' });
        return [];
      }
    }),
  ];
};

export const composeSchemaGraph = (
  schemas: readonly JsonObject[],
): JsonObject | undefined => {
  if (!schemas.length) return undefined;
  if (schemas.length === 1)
    return { '@context': 'https://schema.org', ...schemas[0] };
  return {
    '@context': 'https://schema.org',
    '@graph': schemas.map(({ '@context': _context, ...schema }) => schema),
  };
};
