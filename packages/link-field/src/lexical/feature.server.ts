import {
  convertLexicalNodesToHTML,
  createNode,
  createServerFeature,
} from '@payloadcms/richtext-lexical';
import { fieldSchemasToFormState } from '@payloadcms/ui/forms/fieldSchemasToFormState';
import {
  sanitizeFields,
  type CollectionSlug,
  type Field,
  type RelationshipField,
  type SanitizedConfig,
  type TextField,
} from 'payload';

import { createResolveUrlHook } from '../hooks/resolveUrl.js';
import { createLinkFields, discardPayloadCollections } from '../linkFields.js';
import {
  LINK_FIELD_FEATURE_CLIENT,
  LINK_FIELD_RUNTIME_CONFIG_KEY,
  type LinkFieldFeatureConfig,
  type LinkFieldRuntimeConfig,
  type SerializedLinkFieldNode,
} from '../types.js';
import { getReferenceIdentity } from '../utils/getReferenceIdentity.js';
import { LinkFieldMarkdownTransformer } from './markdown.js';
import { LinkFieldAutoLinkNode, LinkFieldNode } from './nodes.js';
import { normalizeSerializedLinkNode } from './normalize.js';

type LinkFieldFeatureClientProps = Required<
  Pick<LinkFieldFeatureConfig, 'defaultType' | 'showLabel' | 'showNewTab'>
> &
  Pick<LinkFieldFeatureConfig, 'relationTo'>;

const isNamedField = (field: Field, name: string): boolean =>
  'name' in field && field.name === name;

const normalizeHook = ({ node }: any) => normalizeSerializedLinkNode(node);

const escapeAttribute = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

const getRuntime = (config: SanitizedConfig): LinkFieldRuntimeConfig => {
  const runtime = config.custom?.[LINK_FIELD_RUNTIME_CONFIG_KEY] as
    | LinkFieldRuntimeConfig
    | undefined;
  if (!runtime?.resolveDocumentUrl) {
    throw new Error(
      '@sittari/payload-link-field: LinkFieldFeature() requires linkFieldPlugin() to be configured.',
    );
  }
  return runtime;
};

const attachUrlResolver = (
  fields: Field[],
  runtime: LinkFieldRuntimeConfig,
): Field[] =>
  fields.map((field) => {
    if (!isNamedField(field, 'url') || field.type !== 'text') return field;
    const urlField = field as TextField;
    return {
      ...urlField,
      hooks: {
        ...urlField.hooks,
        afterRead: [
          ...(urlField.hooks?.afterRead ?? []),
          createResolveUrlHook(runtime.resolveDocumentUrl),
        ],
      },
      virtual: true,
    };
  });

const getRelationshipField = (fields: Field[]): RelationshipField | undefined =>
  fields.find(
    (field): field is RelationshipField =>
      isNamedField(field, 'reference') && field.type === 'relationship',
  );

const createNodeValidation =
  (fields: Field[]) =>
  async ({ node, validation }: any): Promise<string | true> => {
    normalizeSerializedLinkNode(node);
    const options = validation.options;
    const result = await fieldSchemasToFormState({
      collectionSlug: options.collectionSlug,
      data: node.fields,
      documentData: options.data,
      fields,
      fieldSchemaMap: undefined,
      id: options.id,
      initialBlockData: node.fields,
      operation:
        options.operation === 'create' || options.operation === 'update'
          ? options.operation
          : 'update',
      permissions: {},
      preferences: options.preferences,
      renderAllFields: false,
      req: options.req,
      schemaPath: '',
    });
    const errorPaths = new Set<string>();
    for (const fieldState of Object.values(result)) {
      for (const path of fieldState?.errorPaths ?? []) errorPaths.add(path);
    }
    return errorPaths.size
      ? `The following fields are invalid: ${[...errorPaths].join(', ')}`
      : true;
  };

const createGraphQLPopulationPromise = ({
  fields,
  runtime,
}: {
  fields: Field[];
  runtime: LinkFieldRuntimeConfig;
}) => {
  const relationship = getRelationshipField(fields);
  return (args: any): void => {
    normalizeSerializedLinkNode(args.node);
    const node = args.node as SerializedLinkFieldNode;
    const fieldsData = node.fields;

    if (fieldsData.type === 'custom') {
      fieldsData.url = fieldsData.customUrl ?? null;
      return;
    }

    const identity = getReferenceIdentity({
      reference: fieldsData.reference,
      relationTo: relationship?.relationTo,
    });
    if (!identity) {
      fieldsData.url = null;
      return;
    }

    const promise = (async () => {
      const remainingDepth = Math.max(0, args.depth - args.currentDepth - 1);
      const findArgs = {
        collection: identity.collectionSlug as never,
        context: args.context,
        depth: remainingDepth,
        disableErrors: true,
        draft: args.draft,
        fallbackLocale: args.req.fallbackLocale,
        id: identity.documentId,
        locale: args.req.locale,
        overrideAccess: args.overrideAccess,
        req: args.req,
        showHiddenFields: args.showHiddenFields,
      };
      const document =
        identity.document ?? (await args.req.payload.findByID(findArgs));

      if (!document) {
        fieldsData.url = null;
        return;
      }

      if (args.currentDepth < args.depth) {
        fieldsData.reference = Array.isArray(relationship?.relationTo)
          ? { relationTo: identity.collectionSlug, value: document }
          : document;
      }
      fieldsData.url = await runtime.resolveDocumentUrl({
        collectionSlug: identity.collectionSlug,
        document: document as Record<string, unknown>,
        documentId: identity.documentId,
        fallbackLocale: args.req.fallbackLocale,
        fieldPath: args.field?.name ?? '',
        locale: args.req.locale,
        payload: args.req.payload,
        req: args.req,
        siblingData: fieldsData,
      });
    })().catch((error) => {
      args.req.payload.logger?.error?.({
        err: error,
        msg: 'Failed to populate Lexical link field',
      });
      fieldsData.url = null;
    });
    args.populationPromises.push(promise);
  };
};

const createHTMLConverter = () => ({
  converter: async (args: any): Promise<string> => {
    const node = normalizeSerializedLinkNode(
      args.node,
    ) as SerializedLinkFieldNode;
    const children = await convertLexicalNodesToHTML({
      converters: args.converters,
      currentDepth: args.currentDepth,
      depth: args.depth,
      draft: args.draft,
      lexicalNodes: node.children,
      overrideAccess: args.overrideAccess,
      parent: { ...node, parent: args.parent },
      req: args.req,
      showHiddenFields: args.showHiddenFields,
    });
    const href =
      node.fields.url ??
      (node.fields.type === 'custom' ? node.fields.customUrl : undefined) ??
      '';
    return `<a href="${escapeAttribute(href)}"${
      node.fields.newTab ? ' rel="noopener noreferrer" target="_blank"' : ''
    }>${children}</a>`;
  },
  nodeTypes: ['link', 'autolink'],
});

export const LinkFieldFeature = createServerFeature<
  LinkFieldFeatureConfig,
  LinkFieldFeatureConfig,
  LinkFieldFeatureClientProps
>({
  key: 'link',
  feature: async ({ config, isRoot, parentIsLocalized, props = {} }) => {
    const runtime = getRuntime(config);
    const relationTo = discardPayloadCollections(
      props.relationTo ?? config.collections.map(({ slug }) => slug),
    );
    const rawFields = attachUrlResolver(
      createLinkFields({
        defaultType: props.defaultType,
        relationTo,
        required: true,
        showLabel: props.showLabel,
        showNewTab: props.showNewTab,
      }),
      runtime,
    );
    const sanitizedFields = await sanitizeFields({
      config: config as never,
      fields: rawFields,
      parentIsLocalized,
      requireFieldLevelRichTextEditor: isRoot,
      validRelationships: config.collections.map(({ slug }) => slug),
    });

    const clientProps: LinkFieldFeatureClientProps = {
      defaultType: props.defaultType ?? 'custom',
      relationTo,
      showLabel: props.showLabel ?? true,
      showNewTab: props.showNewTab ?? true,
    };
    const html = createHTMLConverter();
    const validation = createNodeValidation(sanitizedFields);
    const graphQLPopulation = createGraphQLPopulationPromise({
      fields: sanitizedFields,
      runtime,
    });
    const commonNode = {
      converters: { html },
      getSubFields: () => sanitizedFields,
      getSubFieldsData: ({ node }: any) => node?.fields ?? {},
      graphQLPopulationPromises: [graphQLPopulation],
      hooks: {
        afterRead: [normalizeHook],
        beforeChange: [normalizeHook],
        beforeValidate: [normalizeHook],
      },
      validations: [validation],
    };

    return {
      ClientFeature: LINK_FIELD_FEATURE_CLIENT,
      clientFeatureProps: clientProps,
      generateSchemaMap: () => {
        const map = new Map();
        map.set('fields', { fields: sanitizedFields });
        return map;
      },
      markdownTransformers: [LinkFieldMarkdownTransformer],
      nodes: [
        createNode({ ...commonNode, node: LinkFieldAutoLinkNode }),
        createNode({ ...commonNode, node: LinkFieldNode }),
      ],
      sanitizedServerFeatureProps: {
        ...props,
        relationTo: relationTo as CollectionSlug | CollectionSlug[],
      },
    };
  },
});
