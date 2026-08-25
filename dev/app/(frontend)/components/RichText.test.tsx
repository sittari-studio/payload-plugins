import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { RichText } from './RichText.js';

describe('frontend RichText', () => {
  it('renders link-field nodes through the RSC-safe converter', () => {
    const linkNodeState = {
      root: {
        children: [
          {
            children: [
              {
                detail: 0,
                format: 0,
                mode: 'normal',
                style: '',
                text: 'Frontend link',
                type: 'text',
                version: 1,
              },
            ],
            direction: null,
            fields: {
              customUrl: '/ignored',
              type: 'custom',
              url: '/frontend',
            },
            format: '',
            id: 'frontend-link',
            indent: 0,
            type: 'link',
            version: 1,
          },
        ],
        direction: null,
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
      },
    } as unknown as never;
    const html = renderToStaticMarkup(
      createElement(RichText, {
        data: linkNodeState,
      }),
    );

    expect(html).toBe(
      '<div class="payload-richtext"><a href="/frontend">Frontend link</a></div>',
    );
  });
});
