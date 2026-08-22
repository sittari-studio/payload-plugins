import type { TextMatchTransformer } from '@payloadcms/richtext-lexical/lexical/markdown';
import { $createTextNode } from '@payloadcms/richtext-lexical/lexical';

import {
  $createLinkFieldNode,
  $isLinkFieldNode,
  LinkFieldNode,
} from './nodes.js';

const safeMarkdownUrl = (url: string): string =>
  url.replaceAll('\\', '\\\\').replaceAll(')', '\\)');

export const LinkFieldMarkdownTransformer: TextMatchTransformer = {
  type: 'text-match',
  dependencies: [LinkFieldNode],
  export: (node, exportChildren) => {
    if (!$isLinkFieldNode(node)) return null;
    const fields = node.getFields();
    const url =
      fields.url ??
      (fields.type === 'custom' ? fields.customUrl : undefined) ??
      '';
    return `[${exportChildren(node)}](${safeMarkdownUrl(url)})`;
  },
  importRegExp:
    /(?<!!)\[([^[]+)\]\(([^()\s]+)(?:\s"((?:[^"]*\\")*[^"]*)"\s*)?\)/,
  regExp: /(?<!!)\[([^[]+)\]\(([^()\s]+)(?:\s"((?:[^"]*\\")*[^"]*)"\s*)?\)$/,
  replace: (textNode, match) => {
    const [, label, customUrl] = match;
    const link = $createLinkFieldNode({
      fields: { customUrl, label, newTab: false, type: 'custom' },
    });
    const child = $createTextNode(label);
    child.setFormat(textNode.getFormat());
    link.append(child);
    textNode.replace(link);
    return child;
  },
  trigger: ')',
};
