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
  return <Drawer className="seo-schema-drawer" slug={slug} title={title}>
    <DrawerContentContainer className="seo-schema-drawer__content">
      <div className="seo-schema-drawer__body">{children}</div>
      <footer className="seo-schema-drawer__footer">
        <Button buttonStyle="secondary" onClick={onCancel} type="button">{t('cancel')}</Button>
        {onSave ? <Button buttonStyle="primary" disabled={saveDisabled} onClick={onSave} type="button">{saveLabel ?? t('saveSchema')}</Button> : null}
      </footer>
    </DrawerContentContainer>
  </Drawer>
}
