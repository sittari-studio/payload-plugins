import type { DefaultDocumentIDType } from 'payload';

export type ReferenceIdentity = {
  collectionSlug: string;
  document: null | Record<string, unknown>;
  documentId: DefaultDocumentIDType;
};

type RelationshipValue = {
  relationTo?: unknown;
  value?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getDocumentId = (value: unknown): DefaultDocumentIDType | undefined => {
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }

  if (isRecord(value)) {
    const id = value.id;

    if (typeof id === 'string' || typeof id === 'number') {
      return id;
    }
  }

  return undefined;
};

export const getReferenceIdentity = ({
  reference,
  relationTo,
}: {
  reference: unknown;
  relationTo?: string | string[];
}): null | ReferenceIdentity => {
  if (!reference) {
    return null;
  }

  const isPolymorphicValue =
    isRecord(reference) && 'relationTo' in reference && 'value' in reference;

  const relationshipValue = reference as RelationshipValue;
  const collectionSlug = isPolymorphicValue
    ? relationshipValue.relationTo
    : typeof relationTo === 'string'
      ? relationTo
      : undefined;

  if (typeof collectionSlug !== 'string') {
    return null;
  }

  const value = isPolymorphicValue ? relationshipValue.value : reference;
  const documentId = getDocumentId(value);

  if (documentId === undefined) {
    return null;
  }

  return {
    collectionSlug,
    document: isRecord(value) ? value : null,
    documentId,
  };
};
