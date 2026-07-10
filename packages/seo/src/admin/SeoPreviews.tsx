'use client'

import type { UIFieldClientProps } from 'payload'
import { useDocumentInfo, useFormFields, useLocale } from '@payloadcms/ui'
import { useEffect, useMemo, useState } from 'react'

import type { SeoPreview } from '../types.js'
import { useAdminText } from './use-admin-text.js'
import { previewDocumentFromForm, type PreviewFormFields } from './preview-document.js'

const text = (value: unknown): string | undefined => typeof value === 'string' && value.trim() ? value.trim() : undefined

const cardStyle = { background: 'var(--theme-elevation-0)', border: '1px solid var(--theme-elevation-150)', borderRadius: '8px', overflow: 'hidden' }
const mutedStyle = { color: 'var(--theme-elevation-600)', fontSize: '.875rem' }
const clamp = (lines: number) => ({ WebkitBoxOrient: 'vertical' as const, WebkitLineClamp: lines, display: '-webkit-box', overflow: 'hidden' })

/** Displays server-resolved previews while updating from unsaved form state. */
export const SeoPreviews = ({ field }: UIFieldClientProps) => {
  const t = useAdminText()
  const values = useFormFields(([fields]) => fields as PreviewFormFields)
  const { apiURL, data } = useDocumentInfo()
  const locale = useLocale()
  const [preview, setPreview] = useState<SeoPreview>()
  const document = useMemo(() => previewDocumentFromForm(data, values), [data, values])

  useEffect(() => {
    if (!apiURL) return
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`${apiURL}/seo-preview`, {
          body: JSON.stringify({ document, locale: locale?.code ?? '' }),
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
          signal: controller.signal,
        })
        if (response.ok) setPreview(await response.json() as SeoPreview)
      } catch {
        // Preserve the last resolved preview while the editor continues to type or navigates away.
      }
    }, 150)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [apiURL, document, locale?.code])

  const title = preview?.title ?? t('previewTitle')
  const description = preview?.description ?? t('previewDescription')
  const canonicalUrl = preview?.canonicalUrl
  const host = canonicalUrl ? new URL(canonicalUrl).hostname : ''
  const openGraphTitle = preview?.openGraph?.title ?? title
  const openGraphDescription = preview?.openGraph?.description ?? description
  const twitterTitle = preview?.twitter?.title ?? openGraphTitle
  const twitterDescription = preview?.twitter?.description ?? openGraphDescription
  const openGraphImage = preview?.openGraph?.image ?? preview?.image
  const twitterImage = preview?.twitter?.image ?? openGraphImage

  const PreviewImage = ({ src }: { src?: string }) => src
    ? <img alt="" src={src} style={{ aspectRatio: '1.91 / 1', display: 'block', objectFit: 'cover', width: '100%' }} />
    : <div style={{ alignItems: 'center', aspectRatio: '1.91 / 1', background: 'linear-gradient(135deg, var(--theme-elevation-100), var(--theme-elevation-200))', color: 'var(--theme-elevation-600)', display: 'flex', justifyContent: 'center' }}>{t('previewImageMissing')}</div>

  return <section aria-label={t('previewAriaLabel')} style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(18rem, 1fr))' }}>
    <article style={{ ...cardStyle, padding: '1.25rem' }}>
      <div style={mutedStyle}>{t('googleResult')}</div>
      <div style={{ alignItems: 'center', display: 'flex', gap: '.5rem', marginTop: '.75rem' }}>
        <span aria-hidden="true" style={{ alignItems: 'center', background: 'var(--theme-elevation-150)', borderRadius: '50%', display: 'flex', fontSize: '.75rem', height: '1.5rem', justifyContent: 'center', width: '1.5rem' }}>◐</span>
        <div>{host && <div style={{ fontSize: '.875rem' }}>{host}</div>}{canonicalUrl && <div style={{ ...clamp(1), ...mutedStyle }}>{canonicalUrl}</div>}</div>
      </div>
      <div style={{ ...clamp(2), color: 'var(--theme-success-500)', fontSize: '1.25rem', lineHeight: 1.3, marginTop: '.75rem' }}>{title}</div>
      <p style={{ ...clamp(3), color: 'var(--theme-elevation-700)', lineHeight: 1.5, marginBottom: 0 }}>{description}</p>
    </article>
    <article style={cardStyle}>
      <PreviewImage src={openGraphImage} />
      <div style={{ padding: '1rem' }}>
        <div style={mutedStyle}>{t('openGraphPreview')}</div>
        <div style={{ ...clamp(2), fontSize: '1.1rem', fontWeight: 600, marginTop: '.4rem' }}>{openGraphTitle}</div>
        <p style={{ ...clamp(2), ...mutedStyle, lineHeight: 1.45, marginBottom: 0 }}>{openGraphDescription}</p>
      </div>
    </article>
    <article style={cardStyle}>
      <PreviewImage src={twitterImage} />
      <div style={{ borderTop: '1px solid var(--theme-elevation-150)', padding: '1rem' }}>
        <div style={{ ...clamp(2), fontWeight: 600 }}>{twitterTitle}</div>
        <div style={{ ...clamp(2), ...mutedStyle, marginTop: '.35rem' }}>{twitterDescription}</div>
        <div style={{ ...mutedStyle, marginTop: '.65rem' }}>{t('twitterPreview')}</div>
      </div>
    </article>
  </section>
}
