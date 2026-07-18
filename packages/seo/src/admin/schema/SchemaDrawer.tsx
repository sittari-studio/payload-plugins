'use client'

import { Button, Drawer, DrawerContentContainer } from '@payloadcms/ui'
import type { ReactNode, RefObject } from 'react'

import { useAdminText } from '../use-admin-text.js'

export const SchemaDrawer = ({ children, onCancel, onSave, saveDisabled, saveLabel, slug, title }: {
  children: ReactNode
  onCancel: () => void
  onSave?: () => void
  saveDisabled?: boolean
  saveLabel?: string
  slug: string
  title: string
  returnFocusRef?: RefObject<HTMLElement | null>
}) => {
  const t = useAdminText()
  return <Drawer className="[&_.drawer__content]:st-max-w-[1440px] [&_.drawer__content-children]:st-flex [&_.drawer__content-children]:st-min-h-0 [&_.drawer__content-children]:st-flex-col [&_.drawer__content-children]:st-overflow-hidden [&_.drawer__header]:st-shrink-0 [&_.field-type]:st-mb-0 [&_.checkbox-input]:st-mb-0 [&_h3]:st-m-0 [&_h4]:st-m-0 [&_p]:st-mt-[.35rem] [&_p]:st-mb-0 [&_p]:st-text-elevation-600" slug={slug} title={title}>
    <DrawerContentContainer className="st-flex st-min-h-0 st-w-full st-flex-1 st-flex-col st-overflow-hidden st-p-0">
      <div className="st-min-h-0 st-flex-1 st-overflow-auto st-py-base-125 max-[600px]:st-p-base">{children}</div>
      <footer className="st-sticky st-bottom-0 st-flex st-items-center st-justify-end st-gap-base-50 st-border-0 st-border-t st-border-solid st-border-elevation-150 st-bg-elevation-0 st-px-base-125 st-py-base-65 [&_.btn]:st-m-0">
        <Button buttonStyle="secondary" onClick={onCancel} type="button">{t('cancel')}</Button>
        {onSave ? <Button buttonStyle="primary" disabled={saveDisabled} onClick={onSave} type="button">{saveLabel ?? t('saveSchema')}</Button> : null}
      </footer>
    </DrawerContentContainer>
  </Drawer>
}
