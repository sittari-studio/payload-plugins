import type { CollectionConfig, Config, Field } from 'payload';

import { localizedText } from './translations/index.js';
import type { PagesPluginConfig, PageTypes } from './types.js';

const createPageTypeFields = (pageTypes: PageTypes): Field[] =>
  Object.entries(pageTypes).map(([name, pageType]) => ({
    name,
    type: 'group',
    label: false,
    fields: pageType.fields,

    admin: {
      hideGutter: true,
      condition: (_, siblingData) => siblingData?.pageType === name,
    },
  }));

const createPagesCollection = (
  pluginConfig: PagesPluginConfig,
): CollectionConfig => {
  const pageTypes = pluginConfig.pageTypes;

  if (!pageTypes || Object.keys(pageTypes).length === 0) {
    throw new Error('pagesPlugin requires at least one page type');
  }

  const defaultFields: Field[] = [
    {
      name: 'title',
      type: 'text',
      label: localizedText('title'),
      required: true,
      localized: pluginConfig?.localizeTitle ?? true,
    },
    {
      name: 'pageType',
      type: 'select',
      label: localizedText('pageType'),
      required: true,
      defaultValue: Object.keys(pageTypes)[0],
      options: Object.entries(pageTypes).map(([value, pageType]) => ({
        label: pageType.label,
        value,
      })),
    },
    ...createPageTypeFields(pageTypes),
  ];

  const config: CollectionConfig = {
    slug: 'pages',
    admin: {
      useAsTitle: 'title',
    },
    labels: {
      singular: localizedText('page'),
      plural: localizedText('pages'),
    },
    versions: {
      drafts: {
        autosave: {
          interval: 375,
        },
        localizeStatus: true,
        schedulePublish: true,
      },
      maxPerDoc: 50,
    },
    fields: defaultFields,
  };

  if (pluginConfig.overrides) {
    return pluginConfig.overrides(config);
  }
  return config;
};

export const pagesPlugin =
  (pluginConfig: PagesPluginConfig) =>
  (incomingConfig: Config): Config => {
    if (pluginConfig.enabled === false) {
      return incomingConfig;
    }

    return {
      ...incomingConfig,
      collections: [
        ...(incomingConfig.collections ?? []),
        createPagesCollection(pluginConfig),
      ],
    };
  };

export default pagesPlugin;
