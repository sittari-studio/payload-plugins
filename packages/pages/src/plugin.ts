import type { CollectionConfig, Config, Field } from "payload";
import { createSlugField } from "@sittari/payload-slug-field";

import { localizedText } from "./translations/index.js";
import type { PagesPluginConfig, PageTypes } from "./types.js";

const createDefaultPageTypes = (blockSlugs: string[]): PageTypes => ({
  standardContent: {
    label: localizedText("standardContent"),
    fields: [
      {
        name: "content",
        label: localizedText("content"),
        type: "richText",
        localized: true,
      },
    ],
  },
  flexible: {
    label: localizedText("flexible"),
    fields: [
      {
        name: "blocks",
        type: "blocks",
        label: localizedText("blocks"),
        labels: {
          singular: localizedText("block"),
          plural: localizedText("blocks"),
        },
        blockReferences: blockSlugs,
        blocks: [],
      },
    ],
  },
});

const createDefaultSlugField = () =>
  createSlugField({
    instruction: localizedText("homeSlugInstruction"),
  });

const createPageTypeFields = (pageTypes: PageTypes): Field[] =>
  Object.entries(pageTypes).map(([name, pageType]) => ({
    name,
    type: "group",
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
  const defaultPageTypes = createDefaultPageTypes(
    pluginConfig.blockSlugs ?? [],
  );
  const pageTypes =
    pluginConfig.pageTypes?.({ defaultPageTypes }) ?? defaultPageTypes;

  const defaultSlugField = createDefaultSlugField();
  const slugField =
    pluginConfig.slugField?.({ defaultSlugField }) ?? defaultSlugField;

  const defaultFields: Field[] = [
    {
      name: "title",
      type: "text",
      label: localizedText("title"),
      required: true,
      localized: pluginConfig?.localizeTitle ?? true,
    },
    slugField,
    {
      name: "pageType",
      type: "select",
      label: localizedText("pageType"),
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
    slug: "pages",
    admin: {
      useAsTitle: "title",
    },
    labels: {
      singular: localizedText("page"),
      plural: localizedText("pages"),
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
  (pluginConfig: PagesPluginConfig = {}) =>
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
