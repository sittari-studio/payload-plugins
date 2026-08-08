'use client'

import { useLexicalComposerContext } from '@payloadcms/richtext-lexical/lexical/react/LexicalComposerContext'
import { $findMatchingParent, mergeRegister } from '@payloadcms/richtext-lexical/lexical/utils'
import {
  $createTextNode,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_LOW,
  PASTE_COMMAND,
  SELECTION_CHANGE_COMMAND,
  TextNode,
  type LexicalNode,
} from '@payloadcms/richtext-lexical/lexical'
import {
  createClientFeature,
  FieldsDrawer,
  getSelectedNode,
  toolbarFeatureButtonsGroupWithItems,
  useEditorConfigContext,
  useLexicalDrawer,
} from '@payloadcms/richtext-lexical/client'
import { formatDrawerSlug, useEditDepth } from '@payloadcms/ui'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import type { LinkFieldFeatureConfig, LinkFieldNodeFields } from '../types.js'
import { LinkActionButtons } from '../admin/SharedLinkControls.js'
import { isValidUrl } from '../utils/validateUrl.js'
import { LinkFieldMarkdownTransformer } from './markdown.js'
import {
  $createLinkFieldAutoLinkNode,
  $createLinkFieldNode,
  $isLinkFieldAutoLinkNode,
  $isLinkFieldNode,
  $toggleLinkField,
  LinkFieldAutoLinkNode,
  LinkFieldNode,
  OPEN_LINK_FIELD_DRAWER_COMMAND,
  TOGGLE_LINK_FIELD_COMMAND,
} from './nodes.js'

type ClientProps = Required<
  Pick<LinkFieldFeatureConfig, 'defaultType' | 'showLabel' | 'showNewTab'>
>

const LinkIcon = () => (
  <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
    <path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
  </svg>
)

const getSelectedLink = (): LinkFieldNode | null => {
  const selection = $getSelection()
  if (!$isRangeSelection(selection)) return null
  return $findMatchingParent(getSelectedNode(selection), $isLinkFieldNode)
}

const LinkFieldCommandsPlugin = ({ clientProps }: { clientProps: ClientProps }) => {
  const [editor] = useLexicalComposerContext()

  useEffect(
    () =>
      mergeRegister(
        editor.registerCommand(
          TOGGLE_LINK_FIELD_COMMAND,
          (payload) => {
            if (payload && !payload.fields.type) payload.fields.type = clientProps.defaultType
            $toggleLinkField(payload)
            return true
          },
          COMMAND_PRIORITY_LOW,
        ),
        editor.registerCommand(
          PASTE_COMMAND,
          (event) => {
            const selection = $getSelection()
            if (
              !$isRangeSelection(selection) ||
              selection.isCollapsed() ||
              !(event instanceof ClipboardEvent) ||
              !event.clipboardData
            ) return false
            const customUrl = event.clipboardData.getData('text').trim()
            if (!isValidUrl(customUrl) || selection.getNodes().some($isElementNode)) return false
            editor.dispatchCommand(TOGGLE_LINK_FIELD_COMMAND, {
              fields: {
                customUrl,
                label: selection.getTextContent(),
                newTab: false,
                type: 'custom',
              },
            })
            event.preventDefault()
            return true
          },
          COMMAND_PRIORITY_LOW,
        ),
      ),
    [clientProps, editor],
  )
  return null
}

const AUTO_LINK_REGEXP = /(?:https?:\/\/|www\.)[^\s<>()]+/i

const AutoLinkPlugin = () => {
  const [editor] = useLexicalComposerContext()
  useEffect(
    () =>
      editor.registerNodeTransform(TextNode, (textNode) => {
        if ($isLinkFieldNode(textNode.getParent())) return
        const match = AUTO_LINK_REGEXP.exec(textNode.getTextContent())
        if (!match) return
        const start = match.index
        const parts = textNode.splitText(start, start + match[0].length)
        const matched = start === 0 ? parts[0] : parts[1]
        if (!matched || !$isTextNode(matched)) return
        const customUrl = match[0].startsWith('www.') ? `https://${match[0]}` : match[0]
        const link = $createLinkFieldAutoLinkNode({
          fields: { customUrl, label: match[0], newTab: false, type: 'custom' },
        })
        const child = $createTextNode(match[0])
        child.setFormat(matched.getFormat())
        child.setDetail(matched.getDetail())
        child.setStyle(matched.getStyle())
        link.append(child)
        matched.replace(link)
      }),
    [editor],
  )
  return null
}

type DrawerState = {
  data: LinkFieldNodeFields
  selectedNodes: LexicalNode[]
  text: string
}

const LinkFieldEditor = ({
  anchorElem,
  clientProps,
}: {
  anchorElem: HTMLElement
  clientProps: ClientProps
}) => {
  const [editor] = useLexicalComposerContext()
  const { fieldProps: { schemaPath }, uuid } = useEditorConfigContext()
  const editDepth = useEditDepth()
  const drawerSlug = formatDrawerSlug({
    depth: editDepth,
    slug: `lexical-link-field-${uuid}`,
  })
  const { toggleDrawer } = useLexicalDrawer(drawerSlug)
  const [state, setState] = useState<DrawerState>()
  const [activeLink, setActiveLink] = useState<LinkFieldNode | null>(null)
  const editorRef = useRef<HTMLDivElement>(null)

  const readSelection = useCallback(() => {
    const link = getSelectedLink()
    setActiveLink(link)
    if (!link) return
    setState({
      data: { ...link.getFields(), label: link.getTextContent() },
      selectedNodes: link.getChildren(),
      text: link.getTextContent(),
    })
  }, [])

  useEffect(
    () =>
      mergeRegister(
        editor.registerUpdateListener(({ editorState }) => editorState.read(readSelection)),
        editor.registerCommand(
          SELECTION_CHANGE_COMMAND,
          () => {
            readSelection()
            return false
          },
          COMMAND_PRIORITY_LOW,
        ),
        editor.registerCommand(
          OPEN_LINK_FIELD_DRAWER_COMMAND,
          (payload) => {
            const text = payload.text ?? ''
            const fields: LinkFieldNodeFields = {
              ...payload.fields,
              ...(clientProps.showLabel ? { label: payload.fields.label ?? text } : {}),
            }
            editor.dispatchCommand(TOGGLE_LINK_FIELD_COMMAND, { ...payload, fields })
            setState({
              data: fields,
              selectedNodes: payload.selectedNodes ?? [],
              text,
            })
            toggleDrawer()
            return true
          },
          COMMAND_PRIORITY_LOW,
        ),
      ),
    [clientProps.showLabel, editor, readSelection, toggleDrawer],
  )

  const displayUrl = activeLink
    ? state?.data.url ?? state?.data.customUrl
    : undefined

  return createPortal(
    <>
      {activeLink ? (
        <div className="link-editor" ref={editorRef}>
          <div className="link-input">
            <span>{displayUrl || state?.text}</span>
            <LinkActionButtons
              editLabel="Edit link"
              onEdit={toggleDrawer}
              onRemove={() => editor.dispatchCommand(TOGGLE_LINK_FIELD_COMMAND, null)}
              removeLabel="Remove link"
            />
          </div>
        </div>
      ) : null}
      <FieldsDrawer
        className="lexical-link-edit-drawer"
        data={state?.data as never}
        drawerSlug={drawerSlug}
        drawerTitle="Edit link"
        featureKey="link"
        handleDrawerSubmit={(_fields, data) => {
          const currentText = state?.text ?? ''
          const nextFields = data as unknown as LinkFieldNodeFields
          const text = clientProps.showLabel
            ? (typeof nextFields.label === 'string' ? nextFields.label : currentText)
            : currentText

          editor.update(() => {
            const selectedLink = state?.selectedNodes[0]
              ? $findMatchingParent(state.selectedNodes[0], $isLinkFieldNode)
              : getSelectedLink()
            if (selectedLink && $isLinkFieldAutoLinkNode(selectedLink)) {
              selectedLink.replace($createLinkFieldNode({ fields: nextFields }), true)
            }
          })
          editor.dispatchCommand(TOGGLE_LINK_FIELD_COMMAND, {
            fields: { ...nextFields, label: text },
            selectedNodes: state?.selectedNodes,
            text,
          })
        }}
        schemaPath={schemaPath}
        schemaPathSuffix="fields"
      />
    </>,
    anchorElem,
  )
}

const FloatingLinkFieldEditorPlugin = (props: {
  anchorElem: HTMLElement
  clientProps: ClientProps
}) => <LinkFieldEditor {...props} />

const createToolbarGroup = (defaultType: ClientProps['defaultType']) =>
  toolbarFeatureButtonsGroupWithItems([
  {
    ChildComponent: LinkIcon,
    isActive: ({ selection }) => {
      if (!$isRangeSelection(selection)) return false
      return $findMatchingParent(getSelectedNode(selection), $isLinkFieldNode) != null
    },
    isEnabled: ({ selection }) =>
      $isRangeSelection(selection) && selection.getTextContent().length > 0,
    key: 'link',
    label: 'Link',
    onSelect: ({ editor, isActive }) => {
      if (isActive) {
        editor.dispatchCommand(TOGGLE_LINK_FIELD_COMMAND, null)
        return
      }
      let selectedNodes: LexicalNode[] = []
      let text = ''
      editor.getEditorState().read(() => {
        const selection = $getSelection()
        text = selection?.getTextContent() ?? ''
        selectedNodes = selection?.getNodes() ?? []
      })
      if (!text) return
      editor.dispatchCommand(OPEN_LINK_FIELD_DRAWER_COMMAND, {
        fields: {
          label: text,
          newTab: false,
          type: defaultType,
        },
        selectedNodes,
        text,
      })
    },
    order: 1,
  },
  ])

export const LinkFieldFeatureClient = createClientFeature<
  ClientProps,
  ClientProps
>(({ props }) => ({
  markdownTransformers: [LinkFieldMarkdownTransformer],
  nodes: [LinkFieldNode, LinkFieldAutoLinkNode],
  plugins: [
    { Component: LinkFieldCommandsPlugin, position: 'normal' },
    { Component: AutoLinkPlugin, position: 'normal' },
    { Component: FloatingLinkFieldEditorPlugin, position: 'floatingAnchorElem' },
  ],
  sanitizedClientFeatureProps: props,
  toolbarFixed: { groups: [createToolbarGroup(props.defaultType)] },
  toolbarInline: { groups: [createToolbarGroup(props.defaultType)] },
}))
