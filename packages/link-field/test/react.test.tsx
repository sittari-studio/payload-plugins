import { RichText } from '@payloadcms/richtext-lexical/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import {
  LinkFieldJSXConverter,
  type LinkFieldRendererArgs,
} from '../src/exports/react.js';

const textChild = (text: string, format = 0) => ({
  detail: 0,
  format,
  mode: 'normal',
  style: '',
  text,
  type: 'text',
  version: 1,
});

const linkNode = ({
  fields,
  nodeType = 'link',
  text = 'Example',
  textFormat = 0,
}: {
  fields: Record<string, unknown>;
  nodeType?: 'autolink' | 'link';
  text?: string;
  textFormat?: number;
}) => ({
  children: [textChild(text, textFormat)],
  direction: null,
  fields,
  format: '',
  indent: 0,
  ...(nodeType === 'link' ? { id: 'link-id' } : {}),
  type: nodeType,
  version: 1,
});

const renderNode = (
  node: ReturnType<typeof linkNode>,
  renderer?: (args: LinkFieldRendererArgs) => React.ReactNode,
): string =>
  renderToStaticMarkup(
    <RichText
      converters={({ defaultConverters }) => ({
        ...defaultConverters,
        ...LinkFieldJSXConverter({ renderer }),
      })}
      data={
        {
          root: {
            children: [node],
            direction: null,
            format: '',
            indent: 0,
            type: 'root',
            version: 1,
          },
        } as never
      }
      disableContainer
    />,
  );

describe('LinkFieldJSXConverter', () => {
  it('renders custom and reference links only from their populated URLs', () => {
    expect(
      renderNode(
        linkNode({
          fields: { customUrl: '/ignored', type: 'custom', url: '/about' },
        }),
      ),
    ).toBe('<a href="/about">Example</a>');
    expect(
      renderNode(
        linkNode({
          fields: { reference: 1, type: 'reference', url: '/posts/one' },
        }),
      ),
    ).toBe('<a href="/posts/one">Example</a>');
  });

  it('supports autolinks and new-tab attributes', () => {
    expect(
      renderNode(
        linkNode({
          fields: {
            customUrl: 'https://example.com',
            newTab: true,
            type: 'custom',
            url: 'https://example.com',
          },
          nodeType: 'autolink',
        }),
      ),
    ).toBe(
      '<a href="https://example.com" rel="noopener noreferrer" target="_blank">Example</a>',
    );
  });

  it('normalizes legacy custom and internal nodes for a custom renderer', () => {
    const received: LinkFieldRendererArgs[] = [];
    const renderer = (args: LinkFieldRendererArgs) => {
      received.push(args);
      return <span data-kind={args.fields.type}>{args.children}</span>;
    };
    const custom = linkNode({
      fields: { linkType: 'custom', newTab: true, url: '/legacy' },
      text: 'Legacy custom',
    });
    const reference = linkNode({
      fields: {
        doc: { relationTo: 'posts', value: 7 },
        linkType: 'internal',
        url: '/posts/seven',
      },
      text: 'Legacy reference',
    });

    expect(renderNode(custom, renderer)).toBe(
      '<span data-kind="custom">Legacy custom</span>',
    );
    expect(renderNode(reference, renderer)).toBe(
      '<span data-kind="reference">Legacy reference</span>',
    );
    expect(received[0]).toMatchObject({
      fields: {
        customUrl: '/legacy',
        label: 'Legacy custom',
        newTab: true,
        type: 'custom',
        url: '/legacy',
      },
      newTab: true,
      node: custom,
      url: '/legacy',
    });
    expect(received[1]).toMatchObject({
      fields: {
        label: 'Legacy reference',
        reference: { relationTo: 'posts', value: 7 },
        type: 'reference',
        url: '/posts/seven',
      },
      node: reference,
      url: '/posts/seven',
    });
  });

  it('preserves nested formatting', () => {
    expect(
      renderNode(
        linkNode({
          fields: { type: 'custom', url: '/formatted' },
          text: 'Formatted',
          textFormat: 1,
        }),
      ),
    ).toBe('<a href="/formatted"><strong>Formatted</strong></a>');
  });

  it.each([
    ['absent', { customUrl: '/must-not-fallback', type: 'custom' }],
    ['null', { customUrl: '/must-not-fallback', type: 'custom', url: null }],
    ['empty', { customUrl: '/must-not-fallback', type: 'custom', url: '' }],
  ])('renders children only when the resolved URL is %s', (_label, fields) => {
    const renderer = vi.fn<(args: LinkFieldRendererArgs) => React.ReactNode>();
    const html = renderNode(
      linkNode({ fields, text: 'Unlinked', textFormat: 1 }),
      renderer,
    );

    expect(html).toBe('<strong>Unlinked</strong>');
    expect(renderer).not.toHaveBeenCalled();
  });

  it('passes the exact serialized input without mutating legacy fields', () => {
    const node = linkNode({
      fields: { linkType: 'custom', newTab: false, url: '/raw' },
    });
    const before = structuredClone(node);
    let receivedNode: LinkFieldRendererArgs['node'] | undefined;

    renderNode(node, (args) => {
      receivedNode = args.node;
      return args.children;
    });

    expect(receivedNode).toBe(node);
    expect(node).toEqual(before);
  });
});
