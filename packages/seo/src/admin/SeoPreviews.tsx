'use client'

import type { UIFieldClientProps } from 'payload'
import { useFormFields } from '@payloadcms/ui'

import { useAdminText } from './use-admin-text.js'

type Fields = Record<string, { value?: unknown }>

const text = (value: unknown): string | undefined => typeof value === 'string' && value.trim() ? value.trim() : undefined

const imageUrl = (value: unknown): string | undefined => {
  if (!value || typeof value !== 'object') return undefined
  return text((value as Record<string, unknown>).url)
}

const fieldValue = (fields: Fields, path: string): unknown => fields[path]?.value

const cardStyle = { background: 'var(--theme-elevation-0)', border: '1px solid var(--theme-elevation-150)', borderRadius: '8px', overflow: 'hidden' }
const mutedStyle = { color: 'var(--theme-elevation-600)', fontSize: '.875rem' }
const clamp = (lines: number) => ({ WebkitBoxOrient: 'vertical' as const, WebkitLineClamp: lines, display: '-webkit-box', overflow: 'hidden' })

/** Displays informational Google, Open Graph, and Twitter/X previews from unsaved form state. */
export const SeoPreviews = ({ field }: UIFieldClientProps) => {
  const t = useAdminText()
  const values = useFormFields(([fields]) => fields as Fields)
  const seoField = (field.admin?.custom?.seo as { seoField?: string } | undefined)?.seoField ?? 'seo'
  const at = (name: string) => fieldValue(values, `${seoField}.${name}`)
  const title = text(at('title')) ?? t('previewTitle')
  const description = text(at('description')) ?? t('previewDescription')
  const canonicalUrl = text(at('canonical.url')) ?? 'https://example.com/page'
  const openGraphTitle = text(at('openGraph.title')) ?? title
  const openGraphDescription = text(at('openGraph.description')) ?? description
  const twitterTitle = text(at('twitter.title')) ?? openGraphTitle
  const twitterDescription = text(at('twitter.description')) ?? openGraphDescription
  const openGraphImage = imageUrl(at('openGraph.image'))
  const twitterImage = imageUrl(at('twitter.image')) ?? openGraphImage

  const PreviewImage = ({ src }: { src?: string }) => src
    ? <img alt="" src={src} style={{ aspectRatio: '1.91 / 1', display: 'block', objectFit: 'cover', width: '100%' }} />
    : <div style={{ alignItems: 'center', aspectRatio: '1.91 / 1', background: 'linear-gradient(135deg, var(--theme-elevation-100), var(--theme-elevation-200))', color: 'var(--theme-elevation-600)', display: 'flex', justifyContent: 'center' }}>{t('previewImageMissing')}</div>

  return <section aria-label={t('previewAriaLabel')} style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(18rem, 1fr))' }}>
    <article style={{ ...cardStyle, padding: '1.25rem' }}>
      <div style={mutedStyle}>{t('googleResult')}</div>
      <div style={{ alignItems: 'center', display: 'flex', gap: '.5rem', marginTop: '.75rem' }}>
        <span aria-hidden="true" style={{ alignItems: 'center', background: 'var(--theme-elevation-150)', borderRadius: '50%', display: 'flex', fontSize: '.75rem', height: '1.5rem', justifyContent: 'center', width: '1.5rem' }}>◐</span>
        <div><div style={{ fontSize: '.875rem' }}>example.com</div><div style={{ ...clamp(1), ...mutedStyle }}>{canonicalUrl}</div></div>
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
