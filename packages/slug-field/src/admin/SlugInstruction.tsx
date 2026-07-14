'use client'

import { useTranslation } from '@payloadcms/ui'

import type { SlugInstruction as SlugInstructionMessages } from '../types.js'

type SlugInstructionProps = {
  field?: {
    admin?: {
      custom?: {
        slugField?: { instruction?: SlugInstructionMessages }
      }
    }
  }
}

export function SlugInstruction({ field }: SlugInstructionProps) {
  const { i18n } = useTranslation()
  const instruction = field?.admin?.custom?.slugField?.instruction
  const locale = i18n.language.split('-')[0]
  const message = instruction?.[locale] ?? instruction?.[i18n.language] ?? instruction?.en

  if (!message) return null

  return (
    <div style={{ marginTop: '-12px', marginBottom: '20px', color: 'var(--theme-elevation-500)', fontSize: '13px', lineHeight: 1.4 }}>
      {message}
    </div>
  )
}
