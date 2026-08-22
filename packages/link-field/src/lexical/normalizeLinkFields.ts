import type { SerializedLexicalNode } from '@payloadcms/richtext-lexical/lexical';

import type { LinkFieldNodeFields } from '../types.js';

const getSerializedText = (
  children: SerializedLexicalNode[] | undefined,
): string =>
  (children ?? [])
    .map((child) => {
      if ('text' in child && typeof child.text === 'string') return child.text;
      if ('children' in child && Array.isArray(child.children)) {
        return getSerializedText(child.children as SerializedLexicalNode[]);
      }
      return '';
    })
    .join('');

export const normalizeLinkFields = (serializedNode: {
  children?: SerializedLexicalNode[];
  fields?: Record<string, unknown>;
}): LinkFieldNodeFields => {
  const source: Record<string, unknown> = serializedNode.fields ?? {};
  const nativeType = source.linkType;
  const type =
    source.type === 'reference' || nativeType === 'internal'
      ? 'reference'
      : 'custom';
  const childText = getSerializedText(serializedNode.children);
  const fields: LinkFieldNodeFields = {
    type,
    ...(typeof source.newTab === 'boolean' ? { newTab: source.newTab } : {}),
    ...(childText
      ? { label: childText }
      : typeof source.label === 'string'
        ? { label: source.label }
        : {}),
  };

  if (type === 'reference') {
    fields.reference = source.reference ?? source.doc;
    if (typeof source.url === 'string' || source.url === null)
      fields.url = source.url;
  } else {
    fields.customUrl =
      typeof source.customUrl === 'string'
        ? source.customUrl
        : typeof source.url === 'string'
          ? source.url
          : undefined;
    if (typeof source.url === 'string' || source.url === null)
      fields.url = source.url;
  }

  return fields;
};
