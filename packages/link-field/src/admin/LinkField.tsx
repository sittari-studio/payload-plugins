"use client";

import type { ClientField, GroupFieldClientProps } from "payload";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Button,
  Drawer,
  DrawerContentContainer,
  FieldLabel,
  PlusIcon,
  RenderFields,
  formatDrawerSlug,
  useDocumentInfo,
  useField,
  useForm,
  useFormFields,
  useModal,
  useTranslation,
} from "@payloadcms/ui";
import { useDrawerDepth } from "@payloadcms/ui/elements/Drawer";

import type { LinkFieldAdminCustom, LinkFieldValue } from "../types.js";
import { getReferenceIdentity } from "../utils/getReferenceIdentity.js";
import {
  getReferenceSummary,
  hasReferenceTitle,
} from "../utils/getReferenceSummary.js";
import { translate } from "../translations/index.js";
import { EditIcon, XIcon } from "@payloadcms/ui";

const getFieldPath = (parentPath: string, name: string): string =>
  parentPath ? `${parentPath}.${name}` : name;

const getValueAtPath = (data: unknown, path: string): unknown => {
  if (!path) {
    return data;
  }

  return path.split(".").reduce<unknown>((currentValue, pathSegment) => {
    if (!currentValue || typeof currentValue !== "object") {
      return undefined;
    }

    return (currentValue as Record<string, unknown>)[pathSegment];
  }, data);
};

const hasLinkValue = (value: unknown): value is LinkFieldValue => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const link = value as LinkFieldValue;

  return Boolean(link.customUrl || link.reference || link.label || link.url);
};

const getReferenceRelationTo = (
  fields: ClientField[],
): string | string[] | undefined => {
  const referenceField = fields.find(
    (childField) =>
      "name" in childField &&
      childField.name === "reference" &&
      childField.type === "relationship",
  ) as (ClientField & { relationTo?: unknown }) | undefined;

  if (typeof referenceField?.relationTo === "string") {
    return referenceField.relationTo;
  }

  if (
    Array.isArray(referenceField?.relationTo) &&
    referenceField.relationTo.every((relation) => typeof relation === "string")
  ) {
    return referenceField.relationTo;
  }

  return undefined;
};

const getDefaultType = (fields: ClientField[]): LinkFieldValue["type"] => {
  const typeField = fields.find(
    (childField) =>
      "name" in childField &&
      childField.name === "type" &&
      childField.type === "radio",
  ) as (ClientField & { defaultValue?: unknown }) | undefined;

  return typeField?.defaultValue === "reference" ? "reference" : "custom";
};

const getClearValue = (
  fieldName: string,
  defaultType: LinkFieldValue["type"],
): unknown => {
  if (fieldName === "type") {
    return defaultType;
  }

  if (fieldName === "newTab") {
    return false;
  }

  return null;
};

const getClearedLinkValue = (
  fieldNames: string[],
  defaultType: LinkFieldValue["type"],
): LinkFieldValue =>
  fieldNames.reduce<LinkFieldValue>(
    (clearedValue, fieldName) => ({
      ...clearedValue,
      [fieldName]: getClearValue(fieldName, defaultType),
    }),
    {},
  );

const useResolvedReferenceDocument = ({
  apiRoute,
  reference,
  relationTo,
  useAsTitle,
}: {
  apiRoute: string;
  reference: unknown;
  relationTo?: string | string[];
  useAsTitle?: string;
}): null | Record<string, unknown> => {
  const identity = useMemo(
    () =>
      getReferenceIdentity({
        reference,
        relationTo,
      }),
    [reference, relationTo],
  );
  const [resolvedReference, setResolvedReference] = useState<{
    document: null | Record<string, unknown>;
    key: string;
  } | null>(null);
  const needsResolvedDocument =
    identity &&
    (!identity.document || !hasReferenceTitle(identity.document, useAsTitle));
  const referenceKey = needsResolvedDocument
    ? `${identity.collectionSlug}:${identity.documentId}`
    : null;

  useEffect(() => {
    if (!identity || !needsResolvedDocument || !referenceKey) {
      setResolvedReference(null);
      return;
    }

    const abortController = new AbortController();
    const normalizedApiRoute = apiRoute.startsWith("/")
      ? apiRoute
      : `/${apiRoute}`;
    const collectionSlug = encodeURIComponent(identity.collectionSlug);
    const documentId = encodeURIComponent(String(identity.documentId));

    void fetch(
      `${normalizedApiRoute}/${collectionSlug}/${documentId}?depth=0`,
      {
        credentials: "same-origin",
        signal: abortController.signal,
      },
    )
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }

        const document = (await response.json()) as unknown;

        return document && typeof document === "object"
          ? (document as Record<string, unknown>)
          : null;
      })
      .then((document) => {
        setResolvedReference({
          document,
          key: referenceKey,
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setResolvedReference({
          document: null,
          key: referenceKey,
        });
      });

    return () => {
      abortController.abort();
    };
  }, [apiRoute, identity, needsResolvedDocument, referenceKey]);

  if (identity?.document && !needsResolvedDocument) {
    return identity.document;
  }

  return resolvedReference?.key === referenceKey
    ? resolvedReference.document
    : null;
};

const NestedFields = ({
  fields,
  path,
  permissions,
  readOnly,
  schemaPath,
}: {
  fields: ClientField[];
  path: string;
  permissions: GroupFieldClientProps["permissions"];
  readOnly?: boolean;
  schemaPath: string;
}) => (
  <RenderFields
    fields={fields}
    parentIndexPath=""
    parentPath={path}
    parentSchemaPath={schemaPath}
    permissions={permissions ?? true}
    readOnly={readOnly}
  />
);

export const LinkField = (props: GroupFieldClientProps) => {
  const { field, permissions, readOnly, schemaPath } = props;
  const path = props.path ?? "";
  const { setValue, value } = useField<LinkFieldValue>({ path });
  const { initialData } = useDocumentInfo();
  const { dispatchFields, setModified } = useForm();
  const { closeModal, openModal } = useModal();
  const { i18n } = useTranslation();
  const t = useCallback(
    (key: Parameters<typeof translate>[0]) => translate(key, i18n.language),
    [i18n.language],
  );
  const [wasCleared, setWasCleared] = useState(false);
  const custom = field.admin?.custom as LinkFieldAdminCustom | undefined;
  const linkFieldCustom = custom?.linkField;
  const appearance = linkFieldCustom?.appearance ?? "drawer";
  const apiRoute = linkFieldCustom?.apiRoute ?? "/api";
  const collections = linkFieldCustom?.collections;
  const showLabel = linkFieldCustom?.showLabel ?? true;
  const drawerDepth = useDrawerDepth();
  const drawerSlug = useMemo(
    () =>
      formatDrawerSlug({ depth: drawerDepth + 1, slug: `link-field-${path}` }),
    [drawerDepth, path],
  );
  const formValues = useFormFields((context) => {
    const [fields] = context as unknown as [
      Record<string, { value?: unknown }>,
    ];

    return {
      customUrl: fields[getFieldPath(path, "customUrl")]?.value as
        | string
        | undefined,
      label: fields[getFieldPath(path, "label")]?.value as string | undefined,
      reference: fields[getFieldPath(path, "reference")]?.value,
      type: fields[getFieldPath(path, "type")]?.value as LinkFieldValue["type"],
      url: fields[getFieldPath(path, "url")]?.value as
        | null
        | string
        | undefined,
    };
  });
  const initialValue = getValueAtPath(initialData, path) as
    | LinkFieldValue
    | undefined;
  const defaultType = useMemo(
    () => getDefaultType(field.fields),
    [field.fields],
  );
  const childFieldNames = useMemo(
    () =>
      field.fields.flatMap((childField) =>
        "name" in childField ? [childField.name] : [],
      ),
    [field.fields],
  );
  const url =
    formValues.url === undefined
      ? (value?.url ?? (wasCleared ? undefined : initialValue?.url))
      : formValues.url;
  const linkValue = {
    ...(wasCleared ? {} : (initialValue ?? {})),
    ...(value ?? {}),
    ...formValues,
    url,
  };
  const referenceRelationTo = useMemo(
    () => getReferenceRelationTo(field.fields),
    [field.fields],
  );
  const referenceIdentity = useMemo(
    () =>
      getReferenceIdentity({
        reference: linkValue.reference,
        relationTo: referenceRelationTo,
      }),
    [linkValue.reference, referenceRelationTo],
  );
  const referenceUseAsTitle = referenceIdentity
    ? collections?.[referenceIdentity.collectionSlug]?.useAsTitle
    : undefined;
  const resolvedReferenceDocument = useResolvedReferenceDocument({
    apiRoute,
    reference: linkValue.reference,
    relationTo: referenceRelationTo,
    useAsTitle: referenceUseAsTitle,
  });
  const referenceSummary = getReferenceSummary({
    collections,
    reference: linkValue.reference,
    relationTo: referenceRelationTo,
    resolvedDocument: resolvedReferenceDocument,
    language: i18n.language,
  });
  const hasValue = hasLinkValue(linkValue);

  const handleOpenDrawer = useCallback(() => {
    setWasCleared(false);
    openModal(drawerSlug);
  }, [drawerSlug, openModal]);

  const handleClear = useCallback(() => {
    setWasCleared(true);
    setValue(getClearedLinkValue(childFieldNames, defaultType));

    childFieldNames.forEach((fieldName) => {
      dispatchFields({
        path: getFieldPath(path, fieldName),
        type: "UPDATE",
        value: getClearValue(fieldName, defaultType),
      });
    });

    setModified(true);
  }, [
    childFieldNames,
    defaultType,
    dispatchFields,
    path,
    setModified,
    setValue,
  ]);

  const primaryText =
    showLabel && linkValue.label
      ? linkValue.label
      : (referenceSummary ?? t("customLink"));

  const secondaryText = referenceSummary ? referenceSummary : null;

  const nestedFields = field.fields.filter((childField) => {
    if ("name" in childField && childField.name === "url") {
      return false;
    }

    return true;
  });

  if (appearance === "inline") {
    return (
      <div className="link-field field-type link-field--inline">
        <FieldLabel label={field.label} path={path} />
        <NestedFields
          fields={nestedFields}
          path={path}
          permissions={permissions}
          readOnly={readOnly}
          schemaPath={schemaPath ?? ""}
        />
      </div>
    );
  }

  return (
    <div className="link-field field-type link-field--drawer">
      <FieldLabel label={field.label} path={path} />
      {!hasValue ? (
        <div className="">
          <Button
            buttonStyle="primary"
            disabled={readOnly}
            className="link-field__button"
            size="large"
            onClick={handleOpenDrawer}
            iconPosition="left"
            icon={<PlusIcon />}
            type="button"
          >
            {t("addLink")}
          </Button>
        </div>
      ) : (
        <div className="link-field__summary">
          <div className="link-field__summary-text">
            <div className="link-field__summary-primary">
              {primaryText}
              {linkValue.url && (
                <>
                  {" ⋅ "}
                  <span className="link-field__summary-secondary">
                    {linkValue.url || t("noUrlSet")}
                  </span>
                </>
              )}
            </div>
            <div className="link-field__summary-secondary">{secondaryText}</div>
          </div>
          <div className="link-field__actions">
            <Button
              buttonStyle="icon-label"
              className="link-field__button"
              disabled={readOnly}
              onClick={handleOpenDrawer}
              type="button"
              icon={<EditIcon />}
              aria-label={t("edit")}
            ></Button>
            {hasValue ? (
              <Button
                buttonStyle="icon-label"
                className="link-field__button link-field__button--clear"
                disabled={readOnly}
                onClick={handleClear}
                type="button"
                icon={<XIcon />}
                aria-label={t("clear")}
              ></Button>
            ) : null}
          </div>
        </div>
      )}
      <Drawer
        slug={drawerSlug}
        title={typeof field.label === "string" ? field.label : t("link")}
      >
        <DrawerContentContainer>
          <NestedFields
            fields={nestedFields}
            path={path}
            permissions={permissions}
            readOnly={readOnly}
            schemaPath={schemaPath ?? ""}
          />
          <Button buttonStyle="primary" onClick={() => closeModal(drawerSlug)}>
            {t("done")}
          </Button>
        </DrawerContentContainer>
      </Drawer>
    </div>
  );
};
