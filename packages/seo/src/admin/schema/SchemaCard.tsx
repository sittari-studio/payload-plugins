'use client'

import type { ReactNode } from 'react'

export const SchemaCard = ({ actions, badges, name, subtitle }: {
  actions: ReactNode
  badges: ReactNode
  name: string
  subtitle?: string
}) => <article className="seo-schema-card">
  <div className="seo-schema-card__content"><h4>{name}</h4>{subtitle ? <p>{subtitle}</p> : null}<div className="seo-schema-badges">{badges}</div></div>
  <div className="seo-schema-card__actions">{actions}</div>
</article>
