import type {
  CollectionSlug,
  DefaultDocumentIDType,
  FieldHookArgs,
  GroupField,
  Payload,
  PayloadRequest,
} from 'payload'
import type { SerializedElementNode, SerializedLexicalNode } from '@payloadcms/richtext-lexical/lexical'

import type { ReferenceSummaryCollections } from './utils/getReferenceSummary.js'

export type LinkFieldAppearance = 'drawer' | 'inline'

export type LinkFieldType = 'custom' | 'reference'

export type LinkFieldConfig = {
  appearance?: LinkFieldAppearance
  defaultType?: LinkFieldType
  label?: GroupField['label']
  name: string
  relationTo?: CollectionSlug | CollectionSlug[]
  required?: boolean
  showLabel?: boolean
  showNewTab?: boolean
}

export type LinkFieldPluginConfig = {
  resolveDocumentUrl: ResolveDocumentUrl
}

export type LinkFieldFeatureConfig = {
  defaultType?: LinkFieldType
  relationTo?: CollectionSlug | CollectionSlug[]
  showLabel?: boolean
  showNewTab?: boolean
}

export type LinkFieldValue = {
  customUrl?: string
  label?: string
  newTab?: boolean
  reference?: unknown
  type?: LinkFieldType
  url?: null | string
}

export type LinkFieldNodeFields = LinkFieldValue & {
  type: LinkFieldType
}

export type SerializedLinkFieldNode<
  TChild extends SerializedLexicalNode = SerializedLexicalNode,
> = SerializedElementNode<TChild> & {
  fields: LinkFieldNodeFields
  id?: string
  type: 'link'
  version: 1
}

export type SerializedLinkFieldAutoLinkNode<
  TChild extends SerializedLexicalNode = SerializedLexicalNode,
> = SerializedElementNode<TChild> & {
  fields: LinkFieldNodeFields
  type: 'autolink'
  version: 1
}

export type ResolveDocumentUrlArgs = {
  collectionSlug: string
  document: null | Record<string, unknown>
  documentId: DefaultDocumentIDType
  fallbackLocale?: false | null | string | string[]
  fieldPath: string
  locale?: null | string
  originalDoc?: unknown
  payload: Payload
  req: PayloadRequest
  siblingData: Partial<LinkFieldValue>
}

export type ResolveDocumentUrl = (
  args: ResolveDocumentUrlArgs,
) => null | Promise<null | string> | string

export type LinkFieldAdminCustom = {
  linkField?: {
    appearance: LinkFieldAppearance
    apiRoute?: string
    collections?: ReferenceSummaryCollections
    marker: typeof LINK_FIELD_MARKER
    showLabel: boolean
    showNewTab: boolean
  }
}

export type ResolveUrlHookArgs = FieldHookArgs<
  any,
  null | string,
  LinkFieldValue
>

export const LINK_FIELD_MARKER = '@sittari/payload-link-field'

export const LINK_FIELD_ADMIN_COMPONENT =
  '@sittari/payload-link-field/client#LinkField'

export const LINK_FIELD_RELATIONSHIP_COMPONENT =
  '@sittari/payload-link-field/client#ReadableRelationshipField'

export const LINK_FIELD_FEATURE_CLIENT =
  '@sittari/payload-link-field/client#LinkFieldFeatureClient'

export const LINK_FIELD_RUNTIME_CONFIG_KEY = '@sittari/payload-link-field/runtime'

export type LinkFieldRuntimeConfig = {
  resolveDocumentUrl: ResolveDocumentUrl
}
