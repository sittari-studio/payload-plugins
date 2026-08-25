import type {
  CollectionBeforeOperationHook,
  CollectionConfig,
  Config,
  Field,
  NamedGroupField,
  Payload,
  Plugin,
} from 'payload';

import { getTemplateFieldName } from './templateField.js';
import { makeFieldsOptional } from './templateFieldFields.js';
import { createTemplateFallbackHook } from './templateFieldHook.js';
import { localizedText } from './translations/index.js';
import {
  fieldsContain,
  transformBlock,
  transformFields,
} from './traverseFields.js';
import type { TemplateConfig, TemplatesPluginConfig } from './types.js';

const COLLECTION_SLUG = 'templates';
const DATA_FIELD_PREFIX = 'data_';
const RECONCILE_CONTEXT_KEY = 'sittariTemplatesReconcile';
const TEMPLATE_FIELD_ADMIN_COMPONENT =
  '@sittari/payload-templates/client#TemplateField';
const VALID_TEMPLATE_NAME = /^[A-Za-z0-9_]+$/;

type TemplateDocument = {
  id: number | string;
  templateType?: unknown;
  title?: unknown;
};

const dataFieldName = (name: string) => `${DATA_FIELD_PREFIX}${name}`;

const extendOnInit =
  (
    incomingConfig: Config,
    onInit: NonNullable<Config['onInit']>,
  ): NonNullable<Config['onInit']> =>
  async (payload) => {
    if (incomingConfig.onInit) {
      await incomingConfig.onInit(payload);
    }

    await onInit(payload);
  };

const validateTemplates = (
  templates: TemplateConfig[],
  reusableBlocks: NonNullable<Config['blocks']>,
) => {
  const names = new Set<string>();
  const generatedFieldNames = new Set(['title', 'templateType']);

  for (const template of templates) {
    if (!template.name || !VALID_TEMPLATE_NAME.test(template.name)) {
      throw new Error(
        `[templatesPlugin] Invalid template name "${template.name}". Use only letters, numbers, and underscores.`,
      );
    }

    if (names.has(template.name)) {
      throw new Error(
        `[templatesPlugin] Template names must be unique. Duplicate: "${template.name}".`,
      );
    }

    const fieldName = dataFieldName(template.name);
    if (generatedFieldNames.has(fieldName)) {
      throw new Error(
        `[templatesPlugin] Template "${template.name}" conflicts with generated field "${fieldName}".`,
      );
    }

    names.add(template.name);
    generatedFieldNames.add(fieldName);

    const fieldsWithReusableBlocks = makeFieldsOptional(
      template.fields,
      reusableBlocks,
    );
    if (
      fieldsContain(
        fieldsWithReusableBlocks,
        (field) => getTemplateFieldName(field) !== undefined,
      )
    ) {
      throw new Error(
        `[templatesPlugin] templateField cannot be used inside template "${template.name}" definitions.`,
      );
    }
  }
};

const createTemplateFieldTransformer = (
  templates: TemplateConfig[],
  reusableBlocks: NonNullable<Config['blocks']>,
): ((field: Field) => Field) => {
  const templatesByName = new Map(
    templates.map((template) => [template.name, template]),
  );

  return (field) => {
    const templateName = getTemplateFieldName(field);
    if (templateName === undefined) {
      return field;
    }

    const template = templatesByName.get(templateName);
    if (!template) {
      const fieldName = 'name' in field ? field.name : '(unnamed)';
      throw new Error(
        `[templatesPlugin] Unknown template "${templateName}" referenced by field "${fieldName}".`,
      );
    }

    const groupField = field as NamedGroupField;
    const fields = makeFieldsOptional(template.fields, reusableBlocks);
    const localized = fieldsContain(
      fields,
      (templateField) =>
        'localized' in templateField && templateField.localized === true,
    );

    return {
      ...groupField,
      admin: {
        ...groupField.admin,
        components: {
          ...groupField.admin?.components,
          Field: TEMPLATE_FIELD_ADMIN_COMPONENT,
        },
        custom: {
          ...groupField.admin?.custom,
          templateField: {
            dataField: dataFieldName(templateName),
            template: templateName,
          },
        },
      },
      fields,
      hooks: {
        ...groupField.hooks,
        afterRead: [
          ...(groupField.hooks?.afterRead ?? []),
          createTemplateFallbackHook({
            fields,
            localized,
            template: templateName,
          }),
        ],
      },
    };
  };
};

const createTemplateFields = (templates: TemplateConfig[]): Field[] => [
  {
    name: 'title',
    type: 'text',
    required: true,
    access: {
      create: () => false,
      update: () => false,
    },
    admin: {
      hidden: true,
      readOnly: true,
    },
  },
  {
    name: 'templateType',
    type: 'text',
    required: true,
    unique: true,
    access: {
      create: () => false,
      update: () => false,
    },
    admin: {
      hidden: true,
      readOnly: true,
    },
  },
  ...templates.map((template): Field => ({
    name: dataFieldName(template.name),
    type: 'group',
    label: false,
    fields: template.fields,
    admin: {
      condition: (_, siblingData) =>
        siblingData?.templateType === template.name,
      hideGutter: true,
    },
  })),
];

const createTemplatesCollection = (
  templates: TemplateConfig[],
  beforeOperation: CollectionBeforeOperationHook,
): CollectionConfig => ({
  slug: COLLECTION_SLUG,
  access: {
    create: () => false,
    delete: () => false,
  },
  disableDuplicate: true,
  admin: {
    defaultColumns: ['title', 'updatedAt'],
    useAsTitle: 'title',
  },
  labels: {
    singular: localizedText('template'),
    plural: localizedText('templates'),
  },
  hooks: {
    beforeOperation: [beforeOperation],
  },
  fields: createTemplateFields(templates),
});

const reconcileTemplates = async (
  payload: Payload,
  templates: TemplateConfig[],
) => {
  const context = {
    [RECONCILE_CONTEXT_KEY]: true,
  };
  const result = await payload.find({
    collection: COLLECTION_SLUG as never,
    context,
    depth: 0,
    limit: 0,
    overrideAccess: true,
    pagination: false,
  });
  const documents = result.docs as TemplateDocument[];
  const documentsByType = new Map(
    documents
      .filter(
        (document): document is TemplateDocument & { templateType: string } =>
          typeof document.templateType === 'string',
      )
      .map((document) => [document.templateType, document]),
  );
  const configuredNames = new Set(templates.map(({ name }) => name));

  for (const template of templates) {
    const existing = documentsByType.get(template.name);

    if (!existing) {
      const createData = {
        [dataFieldName(template.name)]: template.initialData ?? {},
        templateType: template.name,
        title: template.label,
      };
      await payload.create({
        collection: COLLECTION_SLUG as never,
        context,
        data: createData as never,
        overrideAccess: true,
      });
      continue;
    }

    if (existing.title !== template.label) {
      const updateData = { title: template.label };
      await payload.update({
        collection: COLLECTION_SLUG as never,
        context,
        id: existing.id,
        data: updateData as never,
        overrideAccess: true,
      });
    }
  }

  for (const document of documents) {
    if (
      typeof document.templateType !== 'string' ||
      !configuredNames.has(document.templateType)
    ) {
      await payload.delete({
        collection: COLLECTION_SLUG as never,
        context,
        id: document.id,
        overrideAccess: true,
      });
    }
  }
};

const createTemplateReconciler = (templates: TemplateConfig[]) => {
  let reconciliation: Promise<void> | undefined;

  const reconcile = (payload: Payload): Promise<void> => {
    if (!reconciliation) {
      reconciliation = reconcileTemplates(payload, templates).catch(
        (error: unknown) => {
          reconciliation = undefined;
          throw error;
        },
      );
    }

    return reconciliation;
  };

  const beforeOperation: CollectionBeforeOperationHook = async ({
    context,
    req,
  }) => {
    if (context[RECONCILE_CONTEXT_KEY] === true) {
      return;
    }

    await reconcile(req.payload);
  };

  return {
    beforeOperation,
    reconcile,
  };
};

export const templatesPlugin =
  (pluginConfig: TemplatesPluginConfig): Plugin =>
  (incomingConfig: Config): Config => {
    if (pluginConfig.enabled === false) {
      return incomingConfig;
    }

    validateTemplates(pluginConfig.templates, incomingConfig.blocks ?? []);

    if (
      incomingConfig.collections?.some(({ slug }) => slug === COLLECTION_SLUG)
    ) {
      throw new Error(
        `[templatesPlugin] A collection with slug "${COLLECTION_SLUG}" already exists.`,
      );
    }

    const transformTemplateField = createTemplateFieldTransformer(
      pluginConfig.templates,
      incomingConfig.blocks ?? [],
    );
    const templateReconciler = createTemplateReconciler(pluginConfig.templates);
    const collections = (incomingConfig.collections ?? []).map((collection) => {
      const fields = transformFields(collection.fields, transformTemplateField);
      return fields === collection.fields
        ? collection
        : { ...collection, fields };
    });
    const globals = incomingConfig.globals?.map((global) => {
      const fields = transformFields(global.fields, transformTemplateField);
      return fields === global.fields ? global : { ...global, fields };
    });

    return {
      ...incomingConfig,
      collections: [
        ...collections,
        createTemplatesCollection(
          pluginConfig.templates,
          templateReconciler.beforeOperation,
        ),
      ],
      globals,
      blocks: incomingConfig.blocks?.map((block) =>
        transformBlock(block, transformTemplateField),
      ),
      onInit: extendOnInit(incomingConfig, templateReconciler.reconcile),
    };
  };

export default templatesPlugin;
