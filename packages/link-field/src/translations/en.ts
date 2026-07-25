export const en = {
  addLink: 'Add a link',
  clear: 'Clear',
  customLink: 'Custom link',
  customUrl: 'Custom URL',
  document: 'Document',
  documentReference: 'Document reference',
  documentReferenceRequired: 'Document reference is required.',
  done: 'Done',
  edit: 'Edit',
  enterValidUrl: 'Enter a valid URL.',
  label: 'Label',
  link: 'Link',
  noDocumentSelected: 'No document selected',
  noUrlSet: 'No URL set',
  onlyHttpUrls: 'Only http and https URLs are allowed.',
  openInNewTab: 'Open in new tab',
  protocolRelativeUrl: 'Protocol-relative URLs are not allowed.',
  selectedDocument: 'Selected document',
  selfReference: 'A link cannot reference the current document.',
  url: 'URL',
  urlRequired: 'URL is required.',
} as const

export type LinkFieldTranslation = {
  [Key in keyof typeof en]: string
}
