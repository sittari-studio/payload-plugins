import { sqliteAdapter } from "@payloadcms/db-sqlite";
import { nestedDocsPlugin } from "@payloadcms/plugin-nested-docs";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildConfig } from "payload";
import sharp from "sharp";

import {
  linkFieldPlugin,
  linkField,
  LinkFieldFeature,
} from "@sittari/payload-link-field";
import {
  createFlexiblePageType,
  createStandardContentPageType,
  pagesPlugin,
} from "@sittari/payload-pages";
import { permalinkPlugin } from "@sittari/payload-permalink";
import { rbacPlugin } from "@sittari/payload-rbac";
import { seoPlugin } from "@sittari/payload-seo";
import { templateField, templatesPlugin } from "@sittari/payload-templates";

import { uk } from "@payloadcms/translations/languages/uk";
import { ru } from "@payloadcms/translations/languages/ru";
import { en } from "@payloadcms/translations/languages/en";

import { testEmailAdapter } from "./helpers/testEmailAdapter.js";
import { devRbacPluginConfig } from "./rbac.js";
import { devUser, seed } from "./seed.js";

const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";

const resolvePagePath = (document: Record<string, unknown>): null | string => {
  if (typeof document.path === "string") return document.path;
  if (typeof document.slug !== "string" || !document.slug) return null;
  return `/${document.slug}`;
};

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

if (!process.env.ROOT_DIR) {
  process.env.ROOT_DIR = dirname;
}

const databaseURL =
  process.env.DATABASE_URL ||
  (process.env.NODE_ENV === "test"
    ? `file:${path.resolve(os.tmpdir(), `Sittari-payload-plugins-${process.pid}.sqlite`)}`
    : `file:${path.resolve(dirname, "payload.dev.sqlite")}`);

process.env.DATABASE_URL = databaseURL;

export default buildConfig({
  admin: {
    importMap: {
      baseDir: path.resolve(dirname),
    },
    autoLogin: {
      email: devUser.email,
      password: devUser.password,
      prefillOnly: true,
    },

    user: "users",
  },
  bin: [
    {
      key: "seed",
      scriptPath: path.resolve(dirname, "seed.ts"),
    },
  ],
  collections: [
    {
      slug: "users",
      auth: true,
      fields: [],
    },
    {
      slug: "media",
      fields: [
        {
          name: "alt",
          type: "text",
        },
      ],
      upload: {
        staticDir: path.resolve(dirname, "media"),
      },
    },
    {
      slug: "link-field-test",
      admin: {
        useAsTitle: "title",
      },
      labels: {
        singular: "Link Field Test",
        plural: "Link Field Tests",
      },
      fields: [
        {
          type: "text",
          name: "title",
        },
        linkField({
          name: "link",
          label: "Link to page",
        }),
      ],
    },
    {
      slug: "categories",
      admin: {
        useAsTitle: "title",
      },
      labels: {
        singular: {
          en: "Category",
          uk: "Категорія",
          ru: "Категория",
        },
        plural: {
          en: "Categories",
          uk: "Категорії",
          ru: "Категории",
        },
      },
      fields: [
        {
          name: "title",
          type: "text",
          required: true,
        },
      ],
    },
  ],
  db: sqliteAdapter({
    client: {
      url: databaseURL,
    },
    transactionOptions: {},
  }),
  i18n: {
    supportedLanguages: {
      en,
      uk,
      ru,
    },
  },
  editor: lexicalEditor({
    features: ({ defaultFeatures }) => [
      ...defaultFeatures.filter((x) => x.key !== "link"),
      LinkFieldFeature(),
    ],
  }),
  email: testEmailAdapter,
  globals: [
    {
      slug: "site-settings",
      label: {
        en: "Site settings",
        uk: "Налаштування сайту",
        ru: "Настройки сайта",
      },
      fields: [
        {
          name: "title",
          type: "text",
          required: true,
        },
        {
          name: "description",
          type: "textarea",
        },
      ],
    },
  ],
  onInit: async (payload) => {
    await seed(payload);
  },
  plugins: [
    pagesPlugin({
      pageTypes: {
        standardContent: createStandardContentPageType({}),
        flexible: createFlexiblePageType(),
        templates: {
          label: "Templates",
          fields: [
            templateField({
              name: "cta",
              label: "CTA",
              template: "404",
              admin: {
                hideGutter: true,
              },
            }),
          ],
        },
      },
    }),
    nestedDocsPlugin({
      collections: ["categories"],
    }),
    permalinkPlugin({
      siteUrl,
      localePrefix: "as-needed",
      collections: {
        categories: {
          prefix: "categories",
          parentField: "parent",
        },
        pages: {
          prefix: "",
        },
      },
    }),
    seoPlugin({
      siteUrl,
      collections: {
        pages: {
          fields: {
            title: "title",
          },
          sitemap: {
            fields: ["slug"],
          },
        },
      },
      media: {
        collection: "media",
        resolveMediaUrl: ({ media }) => {
          if (typeof media.url !== "string" || !media.url) return null;
          return new URL(media.url, siteUrl).toString();
        },
      },
      resolveUrl: ({ document, collection }) => {
        if (collection === "pages") {
          return resolvePagePath(document);
        }

        return null;
      },
      resolveChunkUrl: ({ collection, locale, page }) =>
        new URL(
          `/sitemaps/${collection}/${locale}/${page}.xml`,
          siteUrl,
        ).toString(),
      access: {
        settings: {
          read: () => true,
          update: () => true,
        },
        redirects: {
          admin: () => true,
          create: () => true,
          read: () => true,
          update: () => true,
          delete: () => true,
        },
      },
    }),

    linkFieldPlugin({
      resolveDocumentUrl: async ({ collectionSlug, document, payload }) => {
        return `/${collectionSlug}/${document?.slug}`;
      },
    }),
    templatesPlugin({
      templates: [
        {
          name: "404",
          label: "Page 404",
          fields: [
            {
              name: "heading",
              type: "text",
              required: true,
            },
            {
              name: "message",
              type: "textarea",
            },
          ],
          initialData: {
            heading: "Page not found",
          },
        },
      ],
    }),
    // Keep RBAC last so its matrix and access rules include collections and
    // globals introduced by every plugin above.
    rbacPlugin(devRbacPluginConfig),
  ],

  secret: process.env.PAYLOAD_SECRET || "dev-secret-change-me",
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
});
