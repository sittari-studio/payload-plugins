import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildConfig } from 'payload'
import sharp from 'sharp'

import { linkFieldPlugin, linkField } from '@krameri/payload-link-field'
import { seoPlugin } from '@krameri/payload-seo'

import { testEmailAdapter } from './helpers/testEmailAdapter.js'
import { devUser, seed } from './seed.js'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

if (!process.env.ROOT_DIR) {
  process.env.ROOT_DIR = dirname
}

const databaseURL =
  process.env.DATABASE_URL ||
  (process.env.NODE_ENV === 'test'
    ? `file:${path.resolve(os.tmpdir(), `krameri-payload-plugins-${process.pid}.sqlite`)}`
    : `file:${path.resolve(dirname, 'payload.dev.sqlite')}`)

process.env.DATABASE_URL = databaseURL

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

    user: 'users',
  },
  bin: [
    {
      key: 'seed',
      scriptPath: path.resolve(dirname, 'seed.ts'),
    },
  ],
  collections: [
    {
      slug: 'users',
      auth: true,
      fields: [],
    },
    {
      slug: 'media',
      fields: [
        {
          name: 'alt',
          type: 'text',
        },
      ],
      upload: {
        staticDir: path.resolve(dirname, 'media'),
      },
    },
    {
      slug: 'link-field-test',
      admin: {
        useAsTitle: 'title',
      },
      labels: {
        singular: 'Link Field Test',
        plural: 'Link Field Tests',
      },
      fields: [
        {
          type: 'text',
          name: 'title',
        },
        linkField({
          name: 'link',
          label: 'Link to page',
          relationTo: ['pages']
        }),
      ],
    },
    {
      slug: 'pages',
      admin: {
        defaultColumns: ['title', 'slug', 'updatedAt'],
        useAsTitle: 'title',
      },
      labels: {
        singular: 'Page',
        plural: 'Pages',
      },
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true,
        },
        {
          name: 'slug',
          type: 'text',
          index: true,
          required: true,
        },
        {
          name: 'content',
          type: 'richText',
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
  editor: lexicalEditor(),
  email: testEmailAdapter,
  globals: [
    {
      slug: 'site-settings',
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true,
        },
        {
          name: 'description',
          type: 'textarea',
        },
      ],
    },
  ],
  onInit: async (payload) => {
    await seed(payload)
  },
  plugins: [
    seoPlugin({
      collections: {
        pages: {
          schemaType: 'WebPage',
          fields: {
            title: 'title',
          },
          schema: {
            name: 'title',
            about: 'excerpt',
          },
          sitemap: {
            fields: ['slug'],
          },
        },
      },
      media: {
        collection: 'media',
        resolveMediaUrl: ({ media }) => typeof media.url === 'string' ? media.url : null,
      },
      resolveUrl: ({ document }) => typeof document.slug === 'string' ? `/${document.slug}` : null,
      resolveChunkUrl: ({ collection, locale, page }) =>
        `https://example.test/sitemaps/${collection}/${locale}/${page}.xml`,
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
        return `/${collectionSlug}/${document?.slug}`
      }
    })
  ],

  secret: process.env.PAYLOAD_SECRET || 'dev-secret-change-me',
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
