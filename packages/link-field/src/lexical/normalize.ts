import type { SerializedLexicalNode } from '@payloadcms/richtext-lexical/lexical';

import type { SerializedLinkFieldNode } from '../types.js';
import { normalizeLinkFields } from './normalizeLinkFields.js';

export const normalizeSerializedLinkNode = <T extends SerializedLexicalNode>(
  node: T,
): T => {
  if ((node.type !== 'link' && node.type !== 'autolink') || !('fields' in node))
    return node;
  const mutable = node as T & {
    children?: SerializedLexicalNode[];
    fields: Record<string, unknown>;
    version?: number;
  };
  mutable.fields = normalizeLinkFields(
    mutable as unknown as SerializedLinkFieldNode,
  );
  mutable.version = 1;
  return node;
};
