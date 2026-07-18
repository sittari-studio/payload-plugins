'use client'

import type { ReactNode } from 'react'

export const SchemaCard = ({ actions, badges, name, subtitle }: {
  actions: ReactNode
  badges: ReactNode
  name: string
  subtitle?: string
}) => <article className="st-grid st-min-h-[74px] st-grid-cols-[minmax(0,1fr)_auto] st-items-center st-gap-base-60 st-rounded-md st-border st-border-solid st-border-elevation-150 st-bg-elevation-0 st-p-base-65 max-[850px]:st-grid-cols-[auto_1fr] max-[850px]:st-items-start max-[600px]:st-grid-cols-1">
  <div className="st-min-w-0"><h4 className="st-m-0 st-overflow-hidden st-text-ellipsis st-whitespace-nowrap">{name}</h4>{subtitle ? <p className="st-mt-[.35rem] st-mb-0 st-text-xs st-text-elevation-600">{subtitle}</p> : null}<div className="st-mt-[7px] st-flex st-flex-wrap st-gap-[5px]">{badges}</div></div>
  <div className="st-flex st-flex-wrap st-items-center st-gap-1 max-[850px]:st-col-start-2 max-[600px]:st-col-start-1 [&_button]:st-cursor-pointer [&_button]:st-rounded-sm [&_button]:st-border-0 [&_button]:st-bg-transparent [&_button]:st-px-2 [&_button]:st-py-1.5 [&_button]:st-text-foreground [&_button:hover]:st-bg-elevation-100 [&_button:disabled]:st-cursor-not-allowed [&_button:disabled]:st-opacity-35">{actions}</div>
</article>
