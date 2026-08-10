import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { RichText as PayloadRichText } from '@payloadcms/richtext-lexical/react'
import { LinkFieldJSXConverter } from '@sittari/payload-link-field/react'
import { createElement } from 'react'

type RichTextProps = {
  className?: string
  data: SerializedEditorState
}

export const RichText = ({ className, data }: RichTextProps) =>
  createElement(PayloadRichText, {
    className,
    converters: ({ defaultConverters }) => ({
      ...defaultConverters,
      ...LinkFieldJSXConverter(),
    }),
    data,
  })
