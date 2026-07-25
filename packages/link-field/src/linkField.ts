import type { CollectionSlug, GroupField, RelationshipField, TextField } from 'payload'

import {
  LINK_FIELD_ADMIN_COMPONENT,
  LINK_FIELD_MARKER,
  type LinkFieldConfig,
  type LinkFieldType,
} from './types.js'
import { localizedText, translate } from './translations/index.js'
import { validateUrl } from './utils/validateUrl.js'

const getRelationTo = (
  relationTo: CollectionSlug | CollectionSlug[] | undefined,
): CollectionSlug | CollectionSlug[] => {
  if (!relationTo) {
    return []
  }

  return relationTo
}

const isActiveType = (type: LinkFieldType) => (_: unknown, siblingData?: { type?: string }) =>
  (siblingData?.type ?? 'custom') === type

const getReferenceDocumentId = (value: unknown): unknown => {
  if (!value || typeof value !== 'object') {
    return value
  }

  const reference = value as { id?: unknown; value?: unknown }

  if (!('value' in reference) && 'id' in reference) {
    return reference.id
  }

  if (!reference.value || typeof reference.value !== 'object') {
    return reference.value
  }

  return (reference.value as { id?: unknown }).id
}

const getReferenceRelation = (
  value: unknown,
  relationTo: CollectionSlug | CollectionSlug[],
): CollectionSlug | undefined => {
  if (value && typeof value === 'object' && 'relationTo' in value) {
    return (value as { relationTo?: CollectionSlug }).relationTo
  }

  return typeof relationTo === 'string' ? relationTo : undefined
}

const isSelfReference = ({
  collectionSlug,
  documentId,
  reference,
  relationTo,
}: {
  collectionSlug?: string
  documentId?: number | string
  reference: unknown
  relationTo: CollectionSlug | CollectionSlug[]
}): boolean => {
  const referenceRelation = getReferenceRelation(reference, relationTo)

  if (
    !collectionSlug ||
    documentId === undefined ||
    documentId === null ||
    documentId === '' ||
    referenceRelation !== collectionSlug
  ) {
    return false
  }

  return String(getReferenceDocumentId(reference)) === String(documentId)
}

export const linkField = ({
  appearance = 'drawer',
  defaultType = 'custom',
  label,
  name,
  relationTo,
  required = false,
  showLabel = true,
  showNewTab = true,
}: LinkFieldConfig): GroupField => {
  const normalizedRelationTo = getRelationTo(relationTo)

  const customUrlField: TextField = {
    name: 'customUrl',
    type: 'text',
    admin: {
      condition: isActiveType('custom'),
    },
    label: localizedText('url'),
    required,
    validate: (value, { req, siblingData } = {} as any) => {
      const linkSiblingData = siblingData as { type?: string } | undefined

      if (linkSiblingData?.type === 'custom' && required && !value) {
        return translate('urlRequired', req?.i18n?.language)
      }

      return validateUrl(value, req?.i18n?.language)
    },
  }

  const referenceField = {
    name: 'reference',
    type: 'relationship',
    admin: {
      condition: isActiveType('reference'),
    },
    label: localizedText('document'),
    relationTo: normalizedRelationTo as RelationshipField['relationTo'],
    required,
    validate: (value, { collectionSlug, id, req, siblingData } = {} as any) => {
      const linkSiblingData = siblingData as { type?: string } | undefined

      if (linkSiblingData?.type === 'reference' && required && !value) {
        return translate('documentReferenceRequired', req?.i18n?.language)
      }

      if (
        linkSiblingData?.type === 'reference' &&
        isSelfReference({
          collectionSlug,
          documentId: id,
          reference: value,
          relationTo: normalizedRelationTo,
        })
      ) {
        return translate('selfReference', req?.i18n?.language)
      }

      return true
    },
  } as RelationshipField

  return {
    name,
    type: 'group',
    admin: {
      components: {
        Field: LINK_FIELD_ADMIN_COMPONENT,
      },
      custom: {
        linkField: {
          appearance,
          marker: LINK_FIELD_MARKER,
          showLabel,
          showNewTab,
        },
      },
    },
    fields: [
      {
        name: 'type',
        type: 'radio',
        admin: {
          layout: 'horizontal',
        },
        defaultValue: defaultType,
        options: [
          {
            label: localizedText('customUrl'),
            value: 'custom',
          },
          {
            label: localizedText('documentReference'),
            value: 'reference',
          },
        ],
        required: true,
      },
      ...(showLabel
        ? [
          {
            name: 'label',
            type: 'text',
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
        admin: {
          hidden: true,
        },
        hidden: true,
        virtual: true,
      },
    ],
    label,
  }
}
