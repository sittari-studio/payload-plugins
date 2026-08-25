'use client';

import type { UIFieldClientProps } from 'payload';
import {
  Button,
  useDocumentInfo,
  useFormFields,
  useLocale,
} from '@payloadcms/ui';
import { useEffect, useMemo, useState } from 'react';

import type { SeoPreview } from '../types.js';
import { useAdminText } from './use-admin-text.js';
import {
  previewDocumentFromForm,
  type PreviewFormFields,
} from './preview-document.js';

const cardStyle = {
  background: 'var(--theme-elevation-0)',
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: '8px',
  overflow: 'hidden',
};
const mutedStyle = { color: 'var(--theme-elevation-600)', fontSize: '.875rem' };
const clamp = (lines: number) => ({
  WebkitBoxOrient: 'vertical' as const,
  WebkitLineClamp: lines,
  display: '-webkit-box',
  overflow: 'hidden',
});

const PreviewImage = ({
  aspectRatio,
  missingLabel,
  src,
}: {
  aspectRatio: string;
  missingLabel: string;
  src?: string;
}) =>
  src ? (
    <img
      alt=""
      src={src}
      style={{
        aspectRatio,
        display: 'block',
        objectFit: 'cover',
        width: '100%',
      }}
    />
  ) : (
    <div
      style={{
        alignItems: 'center',
        aspectRatio,
        background:
          'linear-gradient(135deg, var(--theme-elevation-100), var(--theme-elevation-200))',
        color: 'var(--theme-elevation-600)',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      {missingLabel}
    </div>
  );

/** `useDocumentInfo().apiURL` includes the current document ID; plugin endpoints are collection routes. */
const previewEndpointUrl = (apiURL: string): string => {
  const url = new URL(apiURL, window.location.origin);
  url.pathname = `${url.pathname.replace(/\/$/, '').replace(/\/[^/]+$/, '')}/seo-preview`;
  url.search = '';
  return url.toString();
};

/** Displays server-resolved previews while updating from unsaved form state. */
export const SeoPreviews = (_props: UIFieldClientProps) => {
  const t = useAdminText();
  const values = useFormFields(([fields]) => fields as PreviewFormFields);
  const { apiURL, data } = useDocumentInfo();
  const locale = useLocale();
  const [preview, setPreview] = useState<SeoPreview>();
  const [schemaCopied, setSchemaCopied] = useState(false);
  const document = useMemo(
    () => previewDocumentFromForm(data, values),
    [data, values],
  );

  useEffect(() => {
    if (!apiURL) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(previewEndpointUrl(apiURL), {
          body: JSON.stringify({ document, locale: locale?.code ?? '' }),
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
          signal: controller.signal,
        });
        if (response.ok) setPreview((await response.json()) as SeoPreview);
      } catch {
        // Preserve the last resolved preview while the editor continues to type or navigates away.
      }
    }, 150);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [apiURL, document, locale?.code]);

  const title = preview?.title ?? t('previewTitle');
  const description = preview?.description ?? t('previewDescription');
  const canonicalUrl = preview?.canonicalUrl;
  const host = canonicalUrl ? new URL(canonicalUrl).hostname : '';
  const openGraphTitle = preview?.openGraph?.title ?? title;
  const openGraphDescription = preview?.openGraph?.description ?? description;
  const twitterTitle = preview?.twitter?.title ?? openGraphTitle;
  const twitterDescription =
    preview?.twitter?.description ?? openGraphDescription;
  const openGraphImage = preview?.openGraph?.image ?? preview?.image;
  const twitterImage = preview?.twitter?.image ?? openGraphImage;
  const twitterAspectRatio =
    preview?.twitter?.card === 'summary' ? '1 / 1' : '2 / 1';
  const schema = preview?.schema
    ? JSON.stringify(preview.schema, null, 2)
    : undefined;

  const copySchema = async () => {
    if (!schema || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(schema);
      setSchemaCopied(true);
      setTimeout(() => setSchemaCopied(false), 2000);
    } catch {
      setSchemaCopied(false);
    }
  };

  return (
    <section
      aria-label={t('previewAriaLabel')}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        width: '100%',
      }}
    >
      <article style={{ ...cardStyle, padding: '1.25rem' }}>
        <div style={mutedStyle}>{t('googleResult')}</div>
        <div
          style={{
            alignItems: 'center',
            display: 'flex',
            gap: '.5rem',
            marginTop: '.75rem',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              alignItems: 'center',
              background: 'var(--theme-elevation-150)',
              borderRadius: '50%',
              display: 'flex',
              fontSize: '.75rem',
              height: '1.5rem',
              justifyContent: 'center',
              width: '1.5rem',
            }}
          >
            ◐
          </span>
          <div>
            {host && <div style={{ fontSize: '.875rem' }}>{host}</div>}
            {canonicalUrl && (
              <div style={{ ...clamp(1), ...mutedStyle }}>{canonicalUrl}</div>
            )}
          </div>
        </div>
        <div
          style={{
            ...clamp(2),
            color: 'var(--theme-success-500)',
            fontSize: '1.25rem',
            lineHeight: 1.3,
            marginTop: '.75rem',
          }}
        >
          {title}
        </div>
        <p
          style={{
            ...clamp(3),
            color: 'var(--theme-elevation-700)',
            lineHeight: 1.5,
            marginBottom: 0,
          }}
        >
          {description}
        </p>
      </article>
      <div
        style={{
          alignItems: 'flex-start',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1.25rem',
        }}
      >
        <article style={{ ...cardStyle, flex: '1 1 18rem', minWidth: 0 }}>
          <PreviewImage
            aspectRatio="1.91 / 1"
            missingLabel={t('previewImageMissing')}
            src={openGraphImage}
          />
          <div style={{ padding: '1rem' }}>
            <div style={mutedStyle}>{t('openGraphPreview')}</div>
            <div
              style={{
                ...clamp(2),
                fontSize: '1.1rem',
                fontWeight: 600,
                marginTop: '.4rem',
              }}
            >
              {openGraphTitle}
            </div>
            <p
              style={{
                ...clamp(2),
                ...mutedStyle,
                lineHeight: 1.45,
                marginBottom: 0,
              }}
            >
              {openGraphDescription}
            </p>
          </div>
        </article>
        <article style={{ ...cardStyle, flex: '1 1 18rem', minWidth: 0 }}>
          <PreviewImage
            aspectRatio={twitterAspectRatio}
            missingLabel={t('previewImageMissing')}
            src={twitterImage}
          />
          <div
            style={{
              borderTop: '1px solid var(--theme-elevation-150)',
              padding: '1rem',
            }}
          >
            <div style={{ ...clamp(2), fontWeight: 600 }}>{twitterTitle}</div>
            <div style={{ ...clamp(2), ...mutedStyle, marginTop: '.35rem' }}>
              {twitterDescription}
            </div>
            <div style={{ ...mutedStyle, marginTop: '.65rem' }}>
              {t('twitterPreview')}
            </div>
          </div>
        </article>
      </div>
      {schema && (
        <article style={{ ...cardStyle, padding: '1rem' }}>
          <div
            style={{
              alignItems: 'center',
              display: 'flex',
              gap: '.75rem',
              justifyContent: 'space-between',
            }}
          >
            <div style={mutedStyle}>{t('generatedJson')}</div>
            <Button
              buttonStyle="secondary"
              margin={false}
              onClick={() => void copySchema()}
              size="small"
              type="button"
            >
              {schemaCopied ? t('copied') : t('copy')}
            </Button>
          </div>
          <pre
            style={{
              background: 'var(--theme-elevation-50)',
              border: '1px solid var(--theme-elevation-150)',
              borderRadius: '6px',
              margin: '.6rem 0 0',
              maxHeight: '18rem',
              overflow: 'auto',
              padding: '1rem',
              whiteSpace: 'pre-wrap',
            }}
          >
            {schema}
          </pre>
        </article>
      )}
    </section>
  );
};
