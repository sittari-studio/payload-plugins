'use client'

import { Button, DrawerContentContainer, EditIcon, XIcon } from '@payloadcms/ui'
import type { ReactNode } from 'react'

export const LinkActionButtons = ({
  editLabel,
  onEdit,
  onRemove,
  readOnly,
  removeLabel,
}: {
  editLabel: string
  onEdit: () => void
  onRemove?: () => void
  readOnly?: boolean
  removeLabel: string
}) => (
  <div className="link-field__actions">
    <Button
      aria-label={editLabel}
      buttonStyle="icon-label"
      className="link-field__button"
      disabled={readOnly}
      icon={<EditIcon />}
      onClick={onEdit}
      type="button"
    />
    {onRemove ? (
      <Button
        aria-label={removeLabel}
        buttonStyle="icon-label"
        className="link-field__button link-field__button--clear"
        disabled={readOnly}
        icon={<XIcon />}
        onClick={onRemove}
        type="button"
      />
    ) : null}
  </div>
)

export const LinkDrawerBody = ({
  children,
  doneLabel,
  onDone,
}: {
  children: ReactNode
  doneLabel: string
  onDone: () => void
}) => (
  <DrawerContentContainer>
    {children}
    <Button buttonStyle="primary" onClick={onDone}>{doneLabel}</Button>
  </DrawerContentContainer>
)
