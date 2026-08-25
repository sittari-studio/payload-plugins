import {
  addClassNamesToElement,
  isHTMLAnchorElement,
} from '@payloadcms/richtext-lexical/lexical/utils';
import {
  $applyNodeReplacement,
  $createTextNode,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  createCommand,
  ElementNode,
  type BaseSelection,
  type DOMConversionMap,
  type EditorConfig,
  type LexicalCommand,
  type LexicalNode,
  type LexicalUpdateJSON,
  type NodeKey,
  type RangeSelection,
} from '@payloadcms/richtext-lexical/lexical';

import type {
  LinkFieldNodeFields,
  SerializedLinkFieldAutoLinkNode,
  SerializedLinkFieldNode,
} from '../types.js';
import { normalizeLinkFields } from './normalizeLinkFields.js';

export type LinkFieldPayload = {
  fields: LinkFieldNodeFields;
  selectedNodes?: LexicalNode[];
  text?: null | string;
};

const createID = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `link-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const getHref = (fields: LinkFieldNodeFields): string =>
  fields.url ?? (fields.type === 'custom' ? fields.customUrl : undefined) ?? '';

/** Plugin-owned node that intentionally keeps Payload's `link` node type for replacement compatibility. */
export class LinkFieldNode extends ElementNode {
  __fields: LinkFieldNodeFields;
  __id: string;

  constructor({
    fields = { type: 'custom' },
    id = createID(),
    key,
  }: {
    fields?: LinkFieldNodeFields;
    id?: string;
    key?: NodeKey;
  } = {}) {
    super(key);
    this.__fields = fields;
    this.__id = id;
  }

  static clone(node: LinkFieldNode): LinkFieldNode {
    return new LinkFieldNode({
      fields: node.__fields,
      id: node.__id,
      key: node.__key,
    });
  }

  static getType(): string {
    return 'link';
  }

  static importDOM(): DOMConversionMap | null {
    return {
      a: (_node) => ({
        conversion: (domNode) => {
          if (!isHTMLAnchorElement(domNode) || !domNode.textContent)
            return { node: null };
          return {
            node: $createLinkFieldNode({
              fields: {
                customUrl: domNode.getAttribute('href') ?? '',
                label: domNode.textContent,
                newTab: domNode.getAttribute('target') === '_blank',
                type: 'custom',
              },
            }),
          };
        },
        priority: 1,
      }),
    };
  }

  static importJSON(
    serializedNode: SerializedLinkFieldAutoLinkNode | SerializedLinkFieldNode,
  ): LinkFieldNode {
    return $createLinkFieldNode({
      fields: normalizeLinkFields(serializedNode as never),
      id: 'id' in serializedNode ? serializedNode.id : undefined,
    }).updateFromJSON(serializedNode as never);
  }

  canBeEmpty(): false {
    return false;
  }
  canInsertTextAfter(): boolean {
    return false;
  }
  canInsertTextBefore(): boolean {
    return false;
  }
  isInline(): true {
    return true;
  }

  createDOM(config: EditorConfig): HTMLAnchorElement {
    const element = document.createElement('a');
    const href = getHref(this.__fields);
    if (href) element.href = href;
    if (this.__fields.newTab) {
      element.target = '_blank';
      element.rel = 'noopener noreferrer';
    }
    addClassNamesToElement(element, config.theme.link);
    return element;
  }

  updateDOM(previous: LinkFieldNode, anchor: HTMLAnchorElement): boolean {
    const href = getHref(this.__fields);
    if (href !== getHref(previous.__fields)) {
      if (href) anchor.href = href;
      else anchor.removeAttribute('href');
    }
    if (this.__fields.newTab !== previous.__fields.newTab) {
      if (this.__fields.newTab) {
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
      } else {
        anchor.removeAttribute('target');
        anchor.removeAttribute('rel');
      }
    }
    return false;
  }

  exportJSON(): SerializedLinkFieldAutoLinkNode | SerializedLinkFieldNode {
    return {
      ...super.exportJSON(),
      fields: {
        ...this.getFields(),
        label: this.getTextContent(),
      },
      id: this.getID(),
      type: 'link',
      version: 1,
    };
  }

  extractWithChild(_child: LexicalNode, selection: BaseSelection): boolean {
    if (!$isRangeSelection(selection)) return false;
    const anchor = selection.anchor.getNode();
    const focus = selection.focus.getNode();
    return (
      this.isParentOf(anchor) &&
      this.isParentOf(focus) &&
      selection.getTextContent().length > 0
    );
  }

  getFields(): LinkFieldNodeFields {
    return this.getLatest().__fields;
  }
  getID(): string {
    return this.getLatest().__id;
  }

  setFields(fields: LinkFieldNodeFields): this {
    this.getWritable().__fields = fields;
    return this;
  }

  setID(id: string): this {
    this.getWritable().__id = id;
    return this;
  }

  updateFromJSON(
    serializedNode: LexicalUpdateJSON<
      SerializedLinkFieldAutoLinkNode | SerializedLinkFieldNode
    >,
  ): this {
    return super
      .updateFromJSON(serializedNode)
      .setFields(normalizeLinkFields(serializedNode as never))
      .setID(
        ('id' in serializedNode && typeof serializedNode.id === 'string'
          ? serializedNode.id
          : undefined) ?? this.__id,
      );
  }

  insertNewAfter(
    selection: RangeSelection,
    restoreSelection = true,
  ): ElementNode | null {
    const element = this.getParentOrThrow().insertNewAfter(
      selection,
      restoreSelection,
    );
    if (!$isElementNode(element)) return null;
    const link = $createLinkFieldNode({ fields: this.__fields });
    element.append(link);
    return link;
  }
}

export class LinkFieldAutoLinkNode extends LinkFieldNode {
  static clone(node: LinkFieldAutoLinkNode): LinkFieldAutoLinkNode {
    return new LinkFieldAutoLinkNode({
      fields: node.__fields,
      id: '',
      key: node.__key,
    });
  }
  static getType(): string {
    return 'autolink';
  }
  static importDOM(): null {
    return null;
  }
  static importJSON(
    serializedNode: SerializedLinkFieldAutoLinkNode,
  ): LinkFieldAutoLinkNode {
    return $createLinkFieldAutoLinkNode({
      fields: normalizeLinkFields(serializedNode as never),
    }).updateFromJSON(serializedNode as never);
  }
  canInsertTextAfter(): boolean {
    return true;
  }
  canInsertTextBefore(): boolean {
    return true;
  }
  exportJSON(): SerializedLinkFieldAutoLinkNode {
    const serialized = super.exportJSON();
    return {
      children: serialized.children,
      direction: serialized.direction,
      fields: serialized.fields,
      format: serialized.format,
      indent: serialized.indent,
      type: 'autolink',
      version: 1,
    };
  }
}

export const $createLinkFieldNode = ({
  fields,
  id,
}: {
  fields?: LinkFieldNodeFields;
  id?: string;
} = {}): LinkFieldNode =>
  $applyNodeReplacement(new LinkFieldNode({ fields, id }));

export const $createLinkFieldAutoLinkNode = ({
  fields,
}: {
  fields?: LinkFieldNodeFields;
} = {}): LinkFieldAutoLinkNode =>
  $applyNodeReplacement(new LinkFieldAutoLinkNode({ fields, id: '' }));

export const $isLinkFieldNode = (
  node: LexicalNode | null | undefined,
): node is LinkFieldNode => node instanceof LinkFieldNode;

export const $isLinkFieldAutoLinkNode = (
  node: LexicalNode | null | undefined,
): node is LinkFieldAutoLinkNode => node instanceof LinkFieldAutoLinkNode;

export const TOGGLE_LINK_FIELD_COMMAND: LexicalCommand<LinkFieldPayload | null> =
  createCommand('TOGGLE_LINK_FIELD_COMMAND');

export const OPEN_LINK_FIELD_DRAWER_COMMAND: LexicalCommand<LinkFieldPayload> =
  createCommand('OPEN_LINK_FIELD_DRAWER_COMMAND');

const getLinkAncestor = (node: LexicalNode): LinkFieldNode | null => {
  let current: LexicalNode | null = node;
  while (current) {
    if ($isLinkFieldNode(current)) return current;
    current = current.getParent();
  }
  return null;
};

export const $toggleLinkField = (payload: LinkFieldPayload | null): void => {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) && !payload?.selectedNodes?.length) return;
  const nodes = $isRangeSelection(selection)
    ? selection.extract()
    : (payload?.selectedNodes ?? []);

  if (!payload) {
    for (const node of nodes) {
      const link = getLinkAncestor(node);
      if (!link) continue;
      for (const child of link.getChildren()) link.insertBefore(child);
      link.remove();
    }
    return;
  }

  const existing = nodes.length ? getLinkAncestor(nodes[0]) : null;
  if (existing) {
    existing.setFields(payload.fields);
    if (payload.text != null && payload.text !== existing.getTextContent()) {
      existing.clear().append($createTextNode(payload.text));
    }
    return;
  }

  let link: LinkFieldNode | null = null;
  let previousParent: LexicalNode | null = null;
  for (const node of nodes) {
    const parent = node.getParent();
    if (!parent || ($isElementNode(node) && !node.isInline())) continue;
    if (!parent.is(previousParent)) {
      previousParent = parent;
      link = $createLinkFieldNode({ fields: payload.fields });
      node.insertBefore(link);
    }
    link?.append(node);
  }
};
