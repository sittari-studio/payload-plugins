import type { CollectionConfig, TextField } from 'payload';

import { SEO_PLUGIN_MARKER, type SeoPluginAccess } from '../types.js';
import { adminLabel, adminTabLabel, adminText } from '../admin/translations.js';
import {
  isAbsoluteHttpUrl,
  normalizeRedirectPath,
} from '../utils/validation.js';

type RedirectData = {
  destination?: unknown;
  destinationType?: unknown;
  enabled?: unknown;
  source?: unknown;
};

const deny = () => false;

const validatePath = (
  value: unknown,
  { req }: { req?: { i18n?: { language?: string } } } = {},
): true | string =>
  normalizeRedirectPath(value)
    ? true
    : adminText('validationInternalPath', req?.i18n?.language);

const normalizeRedirectFields = ({
  data,
}: {
  data?: RedirectData;
}): RedirectData | undefined => {
  if (!data) return data;
  const normalizedSource = normalizeRedirectPath(data.source);
  if (normalizedSource) data.source = normalizedSource;
  if (data.destinationType === 'internal') {
    const normalizedDestination = normalizeRedirectPath(data.destination);
    if (normalizedDestination) data.destination = normalizedDestination;
  } else if (typeof data.destination === 'string') {
    data.destination = data.destination.trim();
  }
  return data;
};

/** Rejects a candidate that creates any enabled internal redirect cycle. */
const validateRedirectGraph = async ({
  data,
  originalDoc,
  req,
  slug,
}: {
  data?: RedirectData;
  originalDoc?: RedirectData;
  req: any;
  slug: string;
}) => {
  const candidate = { ...originalDoc, ...data };
  if (candidate.enabled === false || candidate.destinationType !== 'internal')
    return data;
  const source = normalizeRedirectPath(candidate.source);
  const destination = normalizeRedirectPath(candidate.destination);
  if (!source || !destination) return data;

  const result = await req.payload.find({
    collection: slug,
    depth: 0,
    limit: 0,
    pagination: false,
    where: { enabled: { equals: true } },
    req,
  });
  const redirects = result.docs as Array<RedirectData>;
  const bySource = new Map(
    redirects.map((redirect) => [
      normalizeRedirectPath(redirect.source),
      redirect,
    ]),
  );
  bySource.set(source, candidate);
  let current = destination;
  const visited = new Set<string>();
  for (let remaining = redirects.length + 1; remaining > 0; remaining--) {
    if (current === source || visited.has(current))
      throw new Error(adminText('validationRedirectLoop', req.i18n?.language));
    visited.add(current);
    const next = bySource.get(current);
    if (!next || next.destinationType !== 'internal') return data;
    const normalized = normalizeRedirectPath(next.destination);
    if (!normalized) return data;
    current = normalized;
  }
  throw new Error(adminText('validationRedirectLoop', req.i18n?.language));
};

export const createRedirectsCollection = ({
  access,
  slug,
}: {
  access?: SeoPluginAccess['redirects'];
  slug: string;
}): CollectionConfig => ({
  slug,
  labels: {
    singular: adminLabel('seoRedirect'),
    plural: adminLabel('seoRedirects'),
  },
  timestamps: true,
  access: {
    admin: access?.admin ?? deny,
    create: access?.create ?? deny,
    read: access?.read ?? deny,
    update: access?.update ?? deny,
    delete: access?.delete ?? deny,
  },
  admin: {
    useAsTitle: 'source',
    group: adminTabLabel('seo'),
    defaultColumns: [
      'source',
      'destination',
      'statusCode',
      'enabled',
      'updatedAt',
    ],
    custom: { seo: { marker: SEO_PLUGIN_MARKER } },
  },
  hooks: {
    beforeValidate: [
      normalizeRedirectFields,
      (args) => validateRedirectGraph({ ...args, slug }),
    ],
  },
  fields: [
    {
      name: 'source',
      type: 'text',
      label: adminLabel('source'),
      required: true,
      unique: true,
      index: true,
      validate: validatePath,
    },
    {
      name: 'destinationType',
      type: 'select',
      label: adminLabel('destinationType'),
      required: true,
      defaultValue: 'internal',
      options: [
        { label: adminLabel('internal'), value: 'internal' },
        { label: adminLabel('external'), value: 'external' },
      ],
    },
    {
      name: 'destination',
      type: 'text',
      label: adminLabel('destination'),
      required: true,
      validate: (value, { siblingData, req } = {} as never) =>
        (siblingData as { destinationType?: string } | undefined)
          ?.destinationType === 'external'
          ? isAbsoluteHttpUrl(value) ||
            adminText('validationAbsoluteHttpUrl', req?.i18n?.language)
          : validatePath(value, { req }),
    } as TextField,
    {
      name: 'statusCode',
      type: 'select',
      label: adminLabel('statusCode'),
      required: true,
      defaultValue: '301',
      options: [
        { label: adminLabel('permanentRedirect'), value: '301' },
        { label: adminLabel('temporaryRedirect'), value: '302' },
      ],
    },
    {
      name: 'enabled',
      type: 'checkbox',
      label: adminLabel('enabled'),
      defaultValue: true,
    },
    { name: 'notes', type: 'textarea', label: adminLabel('notes') },
  ],
});
