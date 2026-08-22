import type {
  CollectionSlug,
  DefaultDocumentIDType,
  StaticLabel,
} from 'payload';

import { getReferenceIdentity } from './getReferenceIdentity.js';
import { translate } from '../translations/index.js';

export type ReferenceCollectionSummary = {
  label: StaticLabel;
  useAsTitle?: string;
};

export type ReferenceSummaryCollections = Partial<
  Record<CollectionSlug | string, ReferenceCollectionSummary>
>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const stringifyPrimitive = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return undefined;
};

const getValueByPath = (
  document: Record<string, unknown>,
  path: string,
): unknown =>
  path.split('.').reduce<unknown>((currentValue, pathPart) => {
    if (!isRecord(currentValue)) {
      return undefined;
    }

    return currentValue[pathPart];
  }, document);

const getDisplayValue = (value: unknown): string | undefined => {
  const primitiveValue = stringifyPrimitive(value);

  if (primitiveValue) {
    return primitiveValue;
  }

  if (isRecord(value)) {
    for (const nestedValue of Object.values(value)) {
      const nestedPrimitiveValue = stringifyPrimitive(nestedValue);

      if (nestedPrimitiveValue) {
        return nestedPrimitiveValue;
      }
    }
  }

  return undefined;
};

export const hasReferenceTitle = (
  document: Record<string, unknown>,
  useAsTitle: string | undefined,
): boolean =>
  !useAsTitle || Boolean(getDisplayValue(getValueByPath(document, useAsTitle)));

const getDocumentTitle = ({
  document,
  useAsTitle,
}: {
  document: Record<string, unknown>;
  useAsTitle?: string;
}): string | undefined => {
  const titleFields = [useAsTitle, 'title', 'name', 'slug', 'id'].filter(
    (field): field is string => Boolean(field),
  );

  for (const titleField of titleFields) {
    const displayValue = getDisplayValue(getValueByPath(document, titleField));

    if (displayValue) {
      return displayValue;
    }
  }

  return undefined;
};

const formatReferenceSummary = ({
  collectionLabel,
  fallbackTitle,
  title,
}: {
  collectionLabel?: string;
  fallbackTitle: DefaultDocumentIDType | string;
  title?: string;
}): string => {
  const documentTitle = title || String(fallbackTitle);

  return collectionLabel
    ? `${collectionLabel}: ${documentTitle}`
    : documentTitle;
};

const getCollectionLabel = (
  label: StaticLabel | undefined,
  language: string | undefined,
): string | undefined => {
  if (typeof label === 'string') {
    return label;
  }

  if (!label) {
    return undefined;
  }

  return (
    (language ? label[language] : undefined) ??
    label.en ??
    Object.values(label).find((value) => Boolean(value))
  );
};

export const getReferenceSummary = ({
  collections,
  reference,
  relationTo,
  resolvedDocument,
  language,
}: {
  collections?: ReferenceSummaryCollections;
  language?: string;
  reference: unknown;
  relationTo?: string | string[];
  resolvedDocument?: null | Record<string, unknown>;
}): string => {
  if (!reference) {
    return translate('noDocumentSelected', language);
  }

  const identity = getReferenceIdentity({
    reference,
    relationTo,
  });

  if (identity) {
    const collectionSummary = collections?.[identity.collectionSlug];
    const document = resolvedDocument ?? identity.document;
    const title = document
      ? getDocumentTitle({
          document,
          useAsTitle: collectionSummary?.useAsTitle,
        })
      : undefined;

    return formatReferenceSummary({
      collectionLabel:
        getCollectionLabel(collectionSummary?.label, language) ??
        identity.collectionSlug,
      fallbackTitle: identity.documentId,
      title,
    });
  }

  if (typeof reference === 'string' || typeof reference === 'number') {
    return String(reference);
  }

  if (isRecord(reference)) {
    const value = 'value' in reference ? reference.value : reference;

    if (typeof value === 'string' || typeof value === 'number') {
      return String(value);
    }

    if (isRecord(value)) {
      return (
        getDocumentTitle({
          document: value,
        }) ?? translate('selectedDocument', language)
      );
    }
  }

  return translate('selectedDocument', language);
};
