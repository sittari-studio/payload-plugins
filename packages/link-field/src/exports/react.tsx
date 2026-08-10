import type {
  SerializedAutoLinkNode,
  SerializedLinkNode,
} from '@payloadcms/richtext-lexical'
import type {
  JSXConverterArgs,
  JSXConverters,
} from '@payloadcms/richtext-lexical/react'
import type { ReactNode } from 'react'

import { normalizeLinkFields } from '../lexical/normalizeLinkFields.js'
import type {
  LinkFieldNodeFields,
  SerializedLinkFieldAutoLinkNode,
  SerializedLinkFieldNode,
} from '../types.js'

export type SerializedLinkFieldCompatibleNode =
  | SerializedAutoLinkNode
  | SerializedLinkFieldAutoLinkNode
  | SerializedLinkFieldNode
  | SerializedLinkNode

export type LinkFieldRendererArgs = {
  children: ReactNode
  fields: LinkFieldNodeFields
  newTab: boolean
  node: SerializedLinkFieldCompatibleNode
  url: string
}

export type LinkFieldRenderer = (args: LinkFieldRendererArgs) => ReactNode

export type LinkFieldJSXConverterOptions = {
  renderer?: LinkFieldRenderer
}

const defaultRenderer: LinkFieldRenderer = ({ children, newTab, url }) => (
  <a
    href={url}
    rel={newTab ? 'noopener noreferrer' : undefined}
    target={newTab ? '_blank' : undefined}
  >
    {children}
  </a>
)

export const LinkFieldJSXConverter = ({
  renderer = defaultRenderer,
}: LinkFieldJSXConverterOptions = {}): JSXConverters<SerializedLinkFieldCompatibleNode> => {
  const converter = ({
    node,
    nodesToJSX,
  }: JSXConverterArgs<SerializedLinkFieldCompatibleNode>): ReactNode => {
    const children = nodesToJSX({ nodes: node.children })
    const fields = normalizeLinkFields(node)
    const url = fields.url

    if (typeof url !== 'string' || url.length === 0) return children

    return renderer({
      children,
      fields,
      newTab: fields.newTab === true,
      node,
      url,
    })
  }

  return {
    autolink: converter,
    link: converter,
  }
}

export type {
  LinkFieldNodeFields,
  SerializedLinkFieldAutoLinkNode,
  SerializedLinkFieldNode,
} from '../types.js'
