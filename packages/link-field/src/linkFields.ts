import type {
  CollectionSlug,
  Field,
  RelationshipField,
  TextField,
} from 'payload';

import type { LinkFieldType } from './types.js';
import { LINK_FIELD_RELATIONSHIP_COMPONENT } from './types.js';
import { localizedText, translate } from './translations/index.js';
import { validateUrl } from './utils/validateUrl.js';

export type CreateLinkFieldsConfig = {
  defaultType?: LinkFieldType;
  relationTo?: CollectionSlug | CollectionSlug[];
  required?: boolean;
  showLabel?: boolean;
  showNewTab?: boolean;
  localizeLabel?: boolean;
};

export const normalizeRelationTo = (
  relationTo: CollectionSlug | CollectionSlug[] | undefined,
): CollectionSlug | CollectionSlug[] => relationTo ?? [];

const isPayloadCollection = (slug: CollectionSlug): boolean =>
  slug.startsWith('payload-');

export const discardPayloadCollections = (
  relationTo: CollectionSlug | CollectionSlug[],
): CollectionSlug | CollectionSlug[] => {
  if (typeof relationTo === 'string') {
    return isPayloadCollection(relationTo) ? [] : relationTo;
  }

  return relationTo.filter((slug) => !isPayloadCollection(slug));
};

const isActiveType =
  (type: LinkFieldType) => (_: unknown, siblingData?: { type?: string }) =>
    (siblingData?.type ?? 'custom') === type;

export const getReferenceDocumentId = (value: unknown): unknown => {
  if (!value || typeof value !== 'object') return value;

  const reference = value as { id?: unknown; value?: unknown };
  if (!('value' in reference) && 'id' in reference) return reference.id;
  if (!reference.value || typeof reference.value !== 'object')
    return reference.value;
  return (reference.value as { id?: unknown }).id;
};

export const getReferenceRelation = (
  value: unknown,
  relationTo: CollectionSlug | CollectionSlug[],
): CollectionSlug | undefined => {
  if (value && typeof value === 'object' && 'relationTo' in value) {
    return (value as { relationTo?: CollectionSlug }).relationTo;
  }
  return typeof relationTo === 'string' ? relationTo : undefined;
};

export const isSelfReference = ({
  collectionSlug,
  documentId,
  reference,
  relationTo,
}: {
  collectionSlug?: string;
  documentId?: number | string;
  reference: unknown;
  relationTo: CollectionSlug | CollectionSlug[];
}): boolean => {
  const referenceRelation = getReferenceRelation(reference, relationTo);
  if (
    !collectionSlug ||
    documentId === undefined ||
    documentId === null ||
    documentId === '' ||
    referenceRelation !== collectionSlug
  ) {
    return false;
  }
  return String(getReferenceDocumentId(reference)) === String(documentId);
};

/** Shared schema used by group fields and plugin-owned Lexical link nodes. */
export const createLinkFields = ({
  defaultType = 'custom',
  relationTo,
  required = false,
  showLabel = true,
  showNewTab = true,
  localizeLabel = true,
}: CreateLinkFieldsConfig = {}): Field[] => {
  const normalizedRelationTo = normalizeRelationTo(relationTo);

  const customUrlField: TextField = {
    name: 'customUrl',
    type: 'text',
    admin: { condition: isActiveType('custom') },
    label: localizedText('url'),
    required,
    validate: (value, { req, siblingData } = {} as any) => {
      const siblings = siblingData as { type?: string } | undefined;
      if (siblings?.type === 'custom' && required && !value) {
        return translate('urlRequired', req?.i18n?.language);
      }
      return validateUrl(value, req?.i18n?.language);
    },
  };

  const referenceField: RelationshipField = {
    name: 'reference',
    type: 'relationship',
    admin: {
      components: { Field: LINK_FIELD_RELATIONSHIP_COMPONENT },
      condition: isActiveType('reference'),
    },
    label: localizedText('document'),
    relationTo: normalizedRelationTo as never,
    required,
    validate: (value, { collectionSlug, id, req, siblingData } = {} as any) => {
      const siblings = siblingData as { type?: string } | undefined;
      if (siblings?.type === 'reference' && required && !value) {
        return translate('documentReferenceRequired', req?.i18n?.language);
      }
      if (
        siblings?.type === 'reference' &&
        isSelfReference({
          collectionSlug,
          documentId: id,
          reference: value,
          relationTo: normalizedRelationTo,
        })
      ) {
        return translate('selfReference', req?.i18n?.language);
      }
      return true;
    },
  };

  return [
    {
      name: 'type',
      type: 'radio',
      admin: { layout: 'horizontal' },
      defaultValue: defaultType,
      options: [
        { label: localizedText('customUrl'), value: 'custom' },
        { label: localizedText('documentReference'), value: 'reference' },
      ],
      required: true,
    },
    ...(showLabel
      ? [
          {
            name: 'label',
            type: 'text',
            localized: localizeLabel,
            label: localizedText('label'),
          } satisfies TextField,
        ]
      : []),
    customUrlField,
    referenceField,
    ...(showNewTab
      ? [
          {
            name: 'newTab',
            type: 'checkbox',
            label: localizedText('openInNewTab'),
          } as const,
        ]
      : []),
    {
      name: 'url',
      type: 'text',
      admin: { hidden: true },
      virtual: true,
    } satisfies TextField,
  ];
};
