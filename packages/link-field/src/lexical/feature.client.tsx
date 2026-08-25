'use client';

import { useLexicalComposerContext } from '@payloadcms/richtext-lexical/lexical/react/LexicalComposerContext';
import { useLexicalEditable } from '@payloadcms/richtext-lexical/lexical/react/useLexicalEditable';
import {
  $findMatchingParent,
  mergeRegister,
} from '@payloadcms/richtext-lexical/lexical/utils';
import {
  $createTextNode,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  KEY_ESCAPE_COMMAND,
  PASTE_COMMAND,
  SELECTION_CHANGE_COMMAND,
  TextNode,
  type LexicalNode,
} from '@payloadcms/richtext-lexical/lexical';
import {
  createClientFeature,
  FieldsDrawer,
  getSelectedNode,
  setFloatingElemPositionForLinkEditor,
  toolbarFeatureButtonsGroupWithItems,
  useEditorConfigContext,
  useLexicalDrawer,
} from '@payloadcms/richtext-lexical/client';
import {
  CloseMenuIcon,
  EditIcon,
  ExternalLinkIcon,
  formatDrawerSlug,
  useConfig,
  useEditDepth,
  useLocale,
  useModal,
  useTranslation,
} from '@payloadcms/ui';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import type { LinkFieldFeatureConfig, LinkFieldNodeFields } from '../types.js';
import { translate } from '../translations/index.js';
import { getReferenceDocumentUrl } from '../utils/getReferenceDocumentUrl.js';
import { getReferenceIdentity } from '../utils/getReferenceIdentity.js';
import { isValidUrl } from '../utils/validateUrl.js';
import { LinkFieldMarkdownTransformer } from './markdown.js';
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
} from './nodes.js';

type ClientProps = Required<
  Pick<LinkFieldFeatureConfig, 'defaultType' | 'showLabel' | 'showNewTab'>
> &
  Pick<LinkFieldFeatureConfig, 'relationTo'>;

const getTranslatedLabel = (
  label: unknown,
  language: string,
): string | undefined => {
  if (typeof label === 'string') return label;
  if (!label || typeof label !== 'object') return undefined;

  const translations = label as Record<string, unknown>;
  const translated =
    translations[language] ?? translations.en ?? Object.values(translations)[0];
  return typeof translated === 'string' ? translated : undefined;
};

const getDocumentTitle = (
  document: Record<string, unknown> | null | undefined,
  collection: { admin?: { useAsTitle?: string } } | undefined,
): unknown => document?.[collection?.admin?.useAsTitle ?? 'id'];

const LinkIcon = () => (
  <svg
    aria-hidden="true"
    fill="none"
    height="18"
    viewBox="0 0 24 24"
    width="18"
  >
    <path
      d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2"
    />
  </svg>
);

const getSelectedLink = (): LinkFieldNode | null => {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return null;
  return $findMatchingParent(getSelectedNode(selection), $isLinkFieldNode);
};

const LinkFieldCommandsPlugin = ({
  clientProps,
}: {
  clientProps: ClientProps;
}) => {
  const [editor] = useLexicalComposerContext();

  useEffect(
    () =>
      mergeRegister(
        editor.registerCommand(
          TOGGLE_LINK_FIELD_COMMAND,
          (payload) => {
            if (payload && !payload.fields.type)
              payload.fields.type = clientProps.defaultType;
            $toggleLinkField(payload);
            return true;
          },
          COMMAND_PRIORITY_LOW,
        ),
        editor.registerCommand(
          PASTE_COMMAND,
          (event) => {
            const selection = $getSelection();
            if (
              !$isRangeSelection(selection) ||
              selection.isCollapsed() ||
              !(event instanceof ClipboardEvent) ||
              !event.clipboardData
            )
              return false;
            const customUrl = event.clipboardData.getData('text').trim();
            if (
              !isValidUrl(customUrl) ||
              selection.getNodes().some($isElementNode)
            )
              return false;
            editor.dispatchCommand(TOGGLE_LINK_FIELD_COMMAND, {
              fields: {
                customUrl,
                label: selection.getTextContent(),
                newTab: false,
                type: 'custom',
              },
            });
            event.preventDefault();
            return true;
          },
          COMMAND_PRIORITY_LOW,
        ),
      ),
    [clientProps, editor],
  );
  return null;
};

const AUTO_LINK_REGEXP = /(?:https?:\/\/|www\.)[^\s<>()]+/i;

const AutoLinkPlugin = () => {
  const [editor] = useLexicalComposerContext();
  useEffect(
    () =>
      editor.registerNodeTransform(TextNode, (textNode) => {
        if ($isLinkFieldNode(textNode.getParent())) return;
        const match = AUTO_LINK_REGEXP.exec(textNode.getTextContent());
        if (!match) return;
        const start = match.index;
        const parts = textNode.splitText(start, start + match[0].length);
        const matched = start === 0 ? parts[0] : parts[1];
        if (!matched || !$isTextNode(matched)) return;
        const customUrl = match[0].startsWith('www.')
          ? `https://${match[0]}`
          : match[0];
        const link = $createLinkFieldAutoLinkNode({
          fields: { customUrl, label: match[0], newTab: false, type: 'custom' },
        });
        const child = $createTextNode(match[0]);
        child.setFormat(matched.getFormat());
        child.setDetail(matched.getDetail());
        child.setStyle(matched.getStyle());
        link.append(child);
        matched.replace(link);
      }),
    [editor],
  );
  return null;
};

type DrawerState = {
  data: LinkFieldNodeFields;
  selectedNodes: LexicalNode[];
  text: string;
};

const LinkFieldEditor = ({
  anchorElem,
  clientProps,
}: {
  anchorElem: HTMLElement;
  clientProps: ClientProps;
}) => {
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();
  const {
    fieldProps: { schemaPath },
    uuid,
  } = useEditorConfigContext();
  const { config, getEntityConfig } = useConfig();
  const locale = useLocale();
  const { i18n, t } = useTranslation<
    object,
    'lexical:link:loadingWithEllipsis'
  >();
  const editDepth = useEditDepth();
  const drawerSlug = formatDrawerSlug({
    depth: editDepth,
    slug: `lexical-link-field-${uuid}`,
  });
  const { toggleDrawer } = useLexicalDrawer(drawerSlug);
  const { modalState } = useModal();
  const isDrawerOpen = Boolean(modalState?.[drawerSlug]?.isOpen);
  const [state, setState] = useState<DrawerState>();
  const [activeLink, setActiveLink] = useState<LinkFieldNode | null>(null);
  const [resolvedLinkLabel, setResolvedLinkLabel] = useState<{
    key: string;
    label: string;
  }>();
  const editorRef = useRef<HTMLDivElement>(null);
  const selectedNodeRectRef = useRef<DOMRect | null>(null);

  const setNotLink = useCallback(() => {
    setActiveLink(null);
    selectedNodeRectRef.current = null;
    if (editorRef.current) {
      editorRef.current.style.opacity = '0';
      editorRef.current.style.transform = 'translate(-10000px, -10000px)';
    }
  }, []);

  const updateLinkEditor = useCallback(() => {
    const selection = $getSelection();

    if (!$isRangeSelection(selection)) {
      setNotLink();
      return;
    }

    const selectedNode = getSelectedNode(selection);
    const link = $findMatchingParent(selectedNode, $isLinkFieldNode);
    const selectionLeavesLink = selection.getNodes().some((node) => {
      const nodeLink = $findMatchingParent(node, $isLinkFieldNode);
      return (link && !link.is(nodeLink)) || (nodeLink && !nodeLink.is(link));
    });

    if (!link || selectionLeavesLink) {
      setNotLink();
      return;
    }

    const text = link.getTextContent();
    setActiveLink(link);
    if (!isDrawerOpen) {
      setState({
        data: { ...link.getFields(), label: text },
        selectedNodes: selection.getNodes(),
        text,
      });
    }

    const selectedNodeRect = editor
      .getElementByKey(selectedNode.getKey())
      ?.getBoundingClientRect();
    if (selectedNodeRect) {
      selectedNodeRect.y += 40;
      selectedNodeRectRef.current = selectedNodeRect;
    }
  }, [editor, isDrawerOpen, setNotLink]);

  useEffect(
    () =>
      mergeRegister(
        editor.registerUpdateListener(({ editorState }) =>
          editorState.read(updateLinkEditor),
        ),
        editor.registerCommand(
          SELECTION_CHANGE_COMMAND,
          () => {
            updateLinkEditor();
            return false;
          },
          COMMAND_PRIORITY_LOW,
        ),
        editor.registerCommand(
          KEY_ESCAPE_COMMAND,
          () => {
            if (!activeLink) return false;
            setNotLink();
            return true;
          },
          COMMAND_PRIORITY_HIGH,
        ),
        editor.registerCommand(
          OPEN_LINK_FIELD_DRAWER_COMMAND,
          (payload) => {
            const text = payload.text ?? '';
            const fields: LinkFieldNodeFields = {
              ...payload.fields,
              ...(clientProps.showLabel
                ? { label: payload.fields.label ?? text }
                : {}),
            };
            editor.dispatchCommand(TOGGLE_LINK_FIELD_COMMAND, {
              ...payload,
              fields,
            });
            setState({
              data: fields,
              selectedNodes: payload.selectedNodes ?? [],
              text,
            });
            toggleDrawer();
            return true;
          },
          COMMAND_PRIORITY_LOW,
        ),
      ),
    [
      activeLink,
      clientProps.showLabel,
      editor,
      setNotLink,
      toggleDrawer,
      updateLinkEditor,
    ],
  );

  useLayoutEffect(() => {
    if (!activeLink || !editorRef.current || !selectedNodeRectRef.current)
      return;
    setFloatingElemPositionForLinkEditor(
      selectedNodeRectRef.current,
      editorRef.current,
      anchorElem,
    );
    // `state?.text` intentionally repositions the editor when link text changes.
    // eslint-disable-next-line react/exhaustive-effect-dependencies
  }, [activeLink, anchorElem, state?.text]);

  useEffect(() => {
    const scrollerElement = anchorElem.parentElement;
    const update = () => editor.getEditorState().read(updateLinkEditor);

    window.addEventListener('resize', update);
    scrollerElement?.addEventListener('scroll', update);

    return () => {
      window.removeEventListener('resize', update);
      scrollerElement?.removeEventListener('scroll', update);
    };
  }, [anchorElem.parentElement, editor, updateLinkEditor]);

  useEffect(() => {
    editor.getEditorState().read(updateLinkEditor);
  }, [editor, updateLinkEditor]);

  useEffect(() => {
    const fields = state?.data;
    if (!activeLink || !fields || fields.type === 'custom') return;

    const identity = getReferenceIdentity({
      reference: fields.reference,
      relationTo: clientProps.relationTo,
    });
    if (!identity) return;

    const collection = getEntityConfig({
      collectionSlug: identity.collectionSlug,
    });
    if (!collection) return;

    const collectionLabel =
      getTranslatedLabel(collection.labels.singular, i18n.language) ??
      identity.collectionSlug;
    const useAsTitle = collection.admin?.useAsTitle ?? 'id';
    const formatLabel = (title: unknown): string =>
      t('fields:linkedTo', {
        label: `${collectionLabel} - ${String(title)}`,
      }).replace(/<[^>]*>?/g, '');
    const documentTitle = identity.document?.[useAsTitle];

    if (
      documentTitle !== undefined &&
      documentTitle !== null &&
      documentTitle !== ''
    ) {
      return;
    }

    const abortController = new AbortController();
    const key = `${identity.collectionSlug}:${identity.documentId}:${locale?.code ?? ''}:${i18n.language}`;
    void fetch(
      `${config.serverURL}${getReferenceDocumentUrl({
        apiRoute: config.routes.api,
        collectionSlug: identity.collectionSlug,
        documentId: identity.documentId,
        locale: locale?.code,
      })}`,
      {
        credentials: 'same-origin',
        headers: { 'Accept-Language': i18n.language },
        signal: abortController.signal,
      },
    )
      .then(async (response) => {
        if (!response.ok)
          throw new Error(`HTTP error! Status: ${response.status}`);
        return response.json() as Promise<Record<string, unknown>>;
      })
      .then((document) => {
        setResolvedLinkLabel({
          key,
          label: formatLabel(document[useAsTitle]),
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError')
          return;
        setResolvedLinkLabel({
          key,
          label: formatLabel(
            `${t('general:untitled')} - ID: ${identity.documentId}`,
          ),
        });
      });

    return () => abortController.abort();
  }, [
    activeLink,
    clientProps.relationTo,
    config.routes.api,
    config.serverURL,
    getEntityConfig,
    i18n.language,
    locale?.code,
    state?.data,
    t,
  ]);

  const displayFields = state?.data;
  const displayIdentity = displayFields
    ? getReferenceIdentity({
        reference: displayFields.reference,
        relationTo: clientProps.relationTo,
      })
    : null;
  const displayCollection = displayIdentity
    ? getEntityConfig({ collectionSlug: displayIdentity.collectionSlug })
    : undefined;
  const displayCollectionLabel = displayIdentity
    ? (getTranslatedLabel(displayCollection?.labels.singular, i18n.language) ??
      displayIdentity.collectionSlug)
    : '';
  const displayDocumentTitle = getDocumentTitle(
    displayIdentity?.document,
    displayCollection,
  );
  const displayReferenceKey =
    displayIdentity && displayCollection
      ? `${displayIdentity.collectionSlug}:${displayIdentity.documentId}:${locale?.code ?? ''}:${i18n.language}`
      : null;
  const formatDisplayLabel = (title: unknown): string =>
    t('fields:linkedTo', {
      label: `${displayCollectionLabel} - ${String(title)}`,
    }).replace(/<[^>]*>?/g, '');
  const linkUrl =
    !activeLink || !displayFields
      ? null
      : displayFields.type === 'custom'
        ? (displayFields.customUrl ?? displayFields.url ?? null)
        : displayIdentity && displayCollection
          ? `${config.routes.admin === '/' ? '' : config.routes.admin}/collections/${displayIdentity.collectionSlug}/${displayIdentity.documentId}`
          : (displayFields.url ?? null);
  const linkLabel =
    !activeLink || !displayFields
      ? null
      : displayFields.type === 'custom'
        ? null
        : !displayIdentity || !displayCollection
          ? (displayFields.label ?? null)
          : displayDocumentTitle !== undefined &&
              displayDocumentTitle !== null &&
              displayDocumentTitle !== ''
            ? formatDisplayLabel(displayDocumentTitle)
            : resolvedLinkLabel?.key === displayReferenceKey
              ? resolvedLinkLabel.label
              : formatDisplayLabel(t('lexical:link:loadingWithEllipsis'));

  return createPortal(
    <>
      {activeLink ? (
        <div className="link-editor" ref={editorRef}>
          <div className="link-input">
            {linkUrl ? (
              <a href={linkUrl} rel="noopener noreferrer" target="_blank">
                {state?.data.newTab ? <ExternalLinkIcon /> : null}
                {linkLabel || linkUrl}
              </a>
            ) : (
              <span className="link-input__label-pure">
                {translate('noUrlSet', i18n.language)}
              </span>
            )}
            {isEditable ? (
              <>
                <button
                  aria-label="Edit link"
                  className="link-edit"
                  onClick={(event) => {
                    event.preventDefault();
                    toggleDrawer();
                  }}
                  onMouseDown={(event) => event.preventDefault()}
                  tabIndex={0}
                  type="button"
                >
                  <EditIcon />
                </button>
                {!$isLinkFieldAutoLinkNode(activeLink) ? (
                  <button
                    aria-label="Remove link"
                    className="link-trash"
                    onClick={() =>
                      editor.dispatchCommand(TOGGLE_LINK_FIELD_COMMAND, null)
                    }
                    onMouseDown={(event) => event.preventDefault()}
                    tabIndex={0}
                    type="button"
                  >
                    <CloseMenuIcon />
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      ) : null}
      <FieldsDrawer
        className="lexical-link-edit-drawer"
        data={state?.data as never}
        drawerSlug={drawerSlug}
        drawerTitle={t('fields:editLink')}
        featureKey="link"
        handleDrawerSubmit={(_fields, data) => {
          const currentText = state?.text ?? '';
          const nextFields = data as unknown as LinkFieldNodeFields;
          const text = clientProps.showLabel
            ? typeof nextFields.label === 'string'
              ? nextFields.label
              : currentText
            : currentText;

          editor.update(() => {
            const selectedLink = state?.selectedNodes[0]
              ? $findMatchingParent(state.selectedNodes[0], $isLinkFieldNode)
              : getSelectedLink();
            if (selectedLink && $isLinkFieldAutoLinkNode(selectedLink)) {
              selectedLink.replace(
                $createLinkFieldNode({ fields: nextFields }),
                true,
              );
            }
          });
          editor.dispatchCommand(TOGGLE_LINK_FIELD_COMMAND, {
            fields: { ...nextFields, label: text },
            selectedNodes: state?.selectedNodes,
            text,
          });
        }}
        schemaPath={schemaPath}
        schemaPathSuffix="fields"
      />
    </>,
    anchorElem,
  );
};

const FloatingLinkFieldEditorPlugin = (props: {
  anchorElem: HTMLElement;
  clientProps: ClientProps;
}) => <LinkFieldEditor {...props} />;

const createToolbarGroup = (defaultType: ClientProps['defaultType']) =>
  toolbarFeatureButtonsGroupWithItems([
    {
      ChildComponent: LinkIcon,
      isActive: ({ selection }) => {
        if (!$isRangeSelection(selection)) return false;
        return (
          $findMatchingParent(getSelectedNode(selection), $isLinkFieldNode) !=
          null
        );
      },
      isEnabled: ({ selection }) =>
        $isRangeSelection(selection) && selection.getTextContent().length > 0,
      key: 'link',
      label: 'Link',
      onSelect: ({ editor, isActive }) => {
        if (isActive) {
          editor.dispatchCommand(TOGGLE_LINK_FIELD_COMMAND, null);
          return;
        }
        let selectedNodes: LexicalNode[] = [];
        let text = '';
        editor.getEditorState().read(() => {
          const selection = $getSelection();
          text = selection?.getTextContent() ?? '';
          selectedNodes = selection?.getNodes() ?? [];
        });
        if (!text) return;
        editor.dispatchCommand(OPEN_LINK_FIELD_DRAWER_COMMAND, {
          fields: {
            label: text,
            newTab: false,
            type: defaultType,
          },
          selectedNodes,
          text,
        });
      },
      order: 1,
    },
  ]);

export const LinkFieldFeatureClient = createClientFeature<
  ClientProps,
  ClientProps
>(({ props }) => ({
  markdownTransformers: [LinkFieldMarkdownTransformer],
  nodes: [LinkFieldNode, LinkFieldAutoLinkNode],
  plugins: [
    { Component: LinkFieldCommandsPlugin, position: 'normal' },
    { Component: AutoLinkPlugin, position: 'normal' },
    {
      Component: FloatingLinkFieldEditorPlugin,
      position: 'floatingAnchorElem',
    },
  ],
  sanitizedClientFeatureProps: props,
  toolbarFixed: { groups: [createToolbarGroup(props.defaultType)] },
  toolbarInline: { groups: [createToolbarGroup(props.defaultType)] },
}));
