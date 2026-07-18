"use client";

import {
  Button,
  FieldLabel,
  formatDrawerSlug,
  useConfig,
  useLocale,
  useModal,
  useTranslation,
} from "@payloadcms/ui";
import { useDrawerDepth } from "@payloadcms/ui/elements/Drawer";
import { useMemo, useRef, useState } from "react";
import type { UIFieldClientProps } from "payload";

import "../../admin.css";
import { applyJsonPatch } from "../../schema/json.js";
import { cloneJson, diffEffectiveSchema } from "../../schema/editor.js";
import type { JsonObject, SeoSchemaVariable } from "../../schema/types.js";
import { useAdminText } from "../use-admin-text.js";
import { SchemaCard } from "./SchemaCard.js";
import { SchemaDrawer } from "./SchemaDrawer.js";
import { SchemaEditorPanel } from "./SchemaEditorPanel.js";
import { StarterPicker } from "./StarterPicker.js";
import {
  createClientId,
  isLocalizedSchemaLocale,
  resolveCollectionLabel,
  schemaTypeLabel,
  type EditorDraft,
  type SchemaManagerCustom,
  type StoredCollectionSchemas,
  type StoredSchemaTemplate,
} from "./types.js";
import { usePayloadArray } from "./usePayloadArray.js";

type EditingTarget = { index: number; scope: "collection" | "global" };
type SettingsTab = "collection" | "global";

const collectionSchemasNestedArrays = { templates: {} };

const effectiveTemplate = (template: StoredSchemaTemplate): JsonObject => {
  try {
    return applyJsonPatch(template.schema, template.valueOverrides);
  } catch {
    return cloneJson(template.schema);
  }
};

const toDraft = (
  template: StoredSchemaTemplate,
  localized: boolean,
): EditorDraft => ({
  isDefault: template.isDefault,
  name: template.name,
  schema: localized ? effectiveTemplate(template) : cloneJson(template.schema),
  templateId: template.templateId,
});

export const SettingsSchemaManager = ({
  field,
  path: incomingPath,
  readOnly,
}: UIFieldClientProps) => {
  const t = useAdminText();
  const path = incomingPath ?? "schemaManager";
  const custom = field.admin?.custom?.seo as SchemaManagerCustom | undefined;
  const collections = custom?.collections ?? [];
  const { config, getEntityConfig } = useConfig();
  const { i18n } = useTranslation();
  const collectionName = (slug: string) => {
    const plural = custom?.labeledCollections?.includes(slug)
      ? getEntityConfig({ collectionSlug: slug }).labels.plural
      : undefined;
    return resolveCollectionLabel(plural, slug, i18n.language);
  };
  const locale = useLocale();
  const localized = isLocalizedSchemaLocale({
    defaultLocale: custom?.defaultLocale,
    locale: locale.code,
    localization: config.localization,
  });
  const { closeModal, openModal } = useModal();
  const drawerDepth = useDrawerDepth();
  const drawerSlug = useMemo(
    () =>
      formatDrawerSlug({
        depth: drawerDepth + 1,
        slug: `seo-settings-schema-${path}`,
      }),
    [drawerDepth, path],
  );
  const globalArray = usePayloadArray<StoredSchemaTemplate>({
    path: "globalSchemas",
  });
  const collectionArray = usePayloadArray<StoredCollectionSchemas>({
    nestedArrays: collectionSchemasNestedArrays,
    path: "collectionSchemas",
  });
  const globalSchemas = globalArray.rows;
  const groups = collectionArray.rows;
  const [selectedCollection, setSelectedCollection] = useState(
    collections[0] ?? "",
  );
  const [activeTab, setActiveTab] = useState<SettingsTab>("global");
  const groupIndex = groups.findIndex(
    (group) => group.collection === selectedCollection,
  );
  const templates =
    groupIndex >= 0 && Array.isArray(groups[groupIndex].templates)
      ? groups[groupIndex].templates!
      : [];
  const [stage, setStage] = useState<"editor" | "picker">("picker");
  const [scope, setScope] = useState<"collection" | "global">("global");
  const [editing, setEditing] = useState<EditingTarget>();
  const [draft, setDraft] = useState<EditorDraft>();
  const [baseDraft, setBaseDraft] = useState<EditorDraft>();
  const returnFocus = useRef<HTMLElement | null>(null);

  const close = () => {
    closeModal(drawerSlug);
    requestAnimationFrame(() => returnFocus.current?.focus());
  };
  const beginAdd = (
    nextScope: "collection" | "global",
    element: HTMLElement,
  ) => {
    returnFocus.current = element;
    setScope(nextScope);
    setEditing(undefined);
    setDraft(undefined);
    setBaseDraft(undefined);
    setStage("picker");
    openModal(drawerSlug);
  };
  const beginEdit = (
    nextScope: "collection" | "global",
    index: number,
    template: StoredSchemaTemplate,
    element: HTMLElement,
  ) => {
    const nextBase = toDraft(template, false);
    returnFocus.current = element;
    setScope(nextScope);
    setEditing({ index, scope: nextScope });
    setBaseDraft(nextBase);
    setDraft(toDraft(template, localized));
    setStage("editor");
    openModal(drawerSlug);
  };
  const chooseStarter = (name: string, schema: JsonObject) => {
    setDraft((current) =>
      current
        ? { ...current, schema }
        : {
            name,
            schema,
            templateId: createClientId(),
            ...(scope === "collection" ? { isDefault: false } : {}),
          },
    );
    setStage("editor");
  };
  const save = () => {
    if (!draft?.name.trim()) return;
    if (scope === "global") {
      const existing = editing ? globalSchemas[editing.index] : undefined;
      const stored: StoredSchemaTemplate =
        localized && existing
          ? {
              ...existing,
              valueOverrides: diffEffectiveSchema(
                existing.schema,
                draft.schema,
                { scalarValuesOnly: true },
              ),
            }
          : {
              ...(existing ?? {}),
              templateId: draft.templateId,
              name: draft.name.trim(),
              schema: cloneJson(draft.schema),
            };
      if (editing) globalArray.replace(editing.index, stored);
      else globalArray.add(stored);
    } else {
      const nextGroup: StoredCollectionSchemas =
        groupIndex >= 0
          ? { ...groups[groupIndex] }
          : {
              id: createClientId(),
              collection: selectedCollection,
              templates: [],
            };
      const nextTemplates = [...(nextGroup.templates ?? [])];
      const existing = editing ? nextTemplates[editing.index] : undefined;
      const stored: StoredSchemaTemplate =
        localized && existing
          ? {
              ...existing,
              valueOverrides: diffEffectiveSchema(
                existing.schema,
                draft.schema,
                { scalarValuesOnly: true },
              ),
            }
          : {
              ...(existing ?? {}),
              templateId: draft.templateId,
              name: draft.name.trim(),
              schema: cloneJson(draft.schema),
              isDefault: draft.isDefault === true,
            };
      if (editing) nextTemplates[editing.index] = stored;
      else nextTemplates.push(stored);
      nextGroup.templates = nextTemplates;
      if (groupIndex >= 0) collectionArray.replace(groupIndex, nextGroup);
      else collectionArray.add(nextGroup);
    }
    close();
  };
  const updateTemplates = (nextTemplates: StoredSchemaTemplate[]) => {
    if (groupIndex < 0) return;
    collectionArray.replace(groupIndex, {
      ...groups[groupIndex],
      templates: nextTemplates,
    });
  };
  const remove = (nextScope: "collection" | "global", index: number) => {
    if (!globalThis.confirm(t("confirmDeleteSchema"))) return;
    if (nextScope === "global") globalArray.remove(index);
    else
      updateTemplates(templates.filter((_, itemIndex) => itemIndex !== index));
  };
  const duplicate = (nextScope: "collection" | "global", index: number) => {
    const source =
      nextScope === "global" ? globalSchemas[index] : templates[index];
    const copy = {
      ...cloneJson(source as unknown as JsonObject),
      id: createClientId(),
      templateId: createClientId(),
      name: `${source.name} ${t("copySuffix")}`,
      ...(nextScope === "collection" ? { isDefault: false } : {}),
    } as unknown as StoredSchemaTemplate;
    if (nextScope === "global") globalArray.add(copy, index + 1);
    else
      updateTemplates([
        ...templates.slice(0, index + 1),
        copy,
        ...templates.slice(index + 1),
      ]);
  };
  const variables: SeoSchemaVariable[] =
    scope === "global"
      ? (custom?.globalVariables ?? [])
      : (custom?.collectionVariables?.[selectedCollection] ?? []);
  const disabled = readOnly || localized;

  const cards = (
    items: StoredSchemaTemplate[],
    nextScope: "collection" | "global",
  ) =>
    items.map((template, index) => (
      <SchemaCard
        actions={
          <>
            <button
              disabled={readOnly}
              onClick={(event) =>
                beginEdit(nextScope, index, template, event.currentTarget)
              }
              type="button"
            >
              {t("edit")}
            </button>
            <button
              disabled={disabled}
              onClick={() => duplicate(nextScope, index)}
              type="button"
            >
              {t("duplicate")}
            </button>
            <button
              disabled={disabled || index === 0}
              onClick={() =>
                nextScope === "global"
                  ? globalArray.move(index, index - 1)
                  : updateTemplates([
                      ...templates.slice(0, index - 1),
                      templates[index],
                      templates[index - 1],
                      ...templates.slice(index + 1),
                    ])
              }
              type="button"
            >
              ↑
            </button>
            <button
              disabled={disabled || index === items.length - 1}
              onClick={() =>
                nextScope === "global"
                  ? globalArray.move(index, index + 1)
                  : updateTemplates([
                      ...templates.slice(0, index),
                      templates[index + 1],
                      templates[index],
                      ...templates.slice(index + 2),
                    ])
              }
              type="button"
            >
              ↓
            </button>
            <button
              className="!st-text-error-500"
              disabled={disabled}
              onClick={() => remove(nextScope, index)}
              type="button"
            >
              {t("delete")}
            </button>
          </>
        }
        badges={
          <>
            <span className="st-inline-flex st-rounded-full st-bg-success-100 st-px-2 st-py-[5px] st-text-[11px] st-leading-none st-text-success-700">
              {schemaTypeLabel(effectiveTemplate(template))}
            </span>
            <span className="st-inline-flex st-rounded-full st-bg-elevation-100 st-px-2 st-py-[5px] st-text-[11px] st-leading-none st-text-elevation-800">
              {nextScope === "global"
                ? t("globalScope")
                : collectionName(selectedCollection)}
            </span>
            {template.isDefault ? (
              <span className="st-inline-flex st-rounded-full st-bg-warning-100 st-px-2 st-py-[5px] st-text-[11px] st-leading-none st-text-warning-700">{t("default")}</span>
            ) : null}
          </>
        }
        key={template.id ?? template.templateId}
        name={template.name}
      />
    ));

  return (
    <section className="st-mb-base-150 st-grid st-gap-base [&_.field-type]:st-mb-0 [&_h3]:st-m-0 [&_h4]:st-m-0 [&_p]:st-mt-[.35rem] [&_p]:st-mb-0 [&_p]:st-text-elevation-600">
      <div
        aria-label={t("schema")}
        className="st-flex st-gap-base-25 st-overflow-x-auto st-border-0 st-border-b st-border-solid st-border-elevation-150 [&_button]:st-mb-[-1px] [&_button]:st-cursor-pointer [&_button]:st-border-0 [&_button]:st-border-b-2 [&_button]:st-border-solid [&_button]:st-border-b-transparent [&_button]:st-bg-transparent [&_button]:st-px-base-75 [&_button]:st-py-base-55 [&_button]:st-font-[inherit] [&_button]:st-font-semibold [&_button]:st-text-elevation-600 [&_button:hover]:st-text-foreground [&_button:focus-visible]:st-rounded-sm [&_button:focus-visible]:st-outline [&_button:focus-visible]:st-outline-2 [&_button:focus-visible]:st-outline-offset-[-2px] [&_button:focus-visible]:st-outline-success-400 max-[600px]:[&_button]:st-flex-[1_0_auto]"
        role="tablist"
      >
        {(["global", "collection"] as const).map((tab) => (
          <button
            aria-controls={`seo-schema-${tab}-panel`}
            aria-selected={activeTab === tab}
            className={activeTab === tab ? "!st-border-b-success-500 !st-text-foreground" : undefined}
            id={`seo-schema-${tab}-tab`}
            key={tab}
            onClick={() => setActiveTab(tab)}
            role="tab"
            tabIndex={activeTab === tab ? 0 : -1}
            type="button"
          >
            {tab === "global" ? t("globalSchemas") : t("collectionSchemas")}
          </button>
        ))}
      </div>

      <div
        aria-labelledby="seo-schema-global-tab"
        hidden={activeTab !== "global"}
        id="seo-schema-global-panel"
        role="tabpanel"
      >
        <div className="st-grid st-gap-base-70">
          <div className="st-flex st-items-center st-justify-between st-gap-base max-[600px]:st-flex-col max-[600px]:st-items-stretch">
            <p>{t("globalSchemasDescription")}</p>
            <Button
              buttonStyle="primary"
              disabled={disabled}
              onClick={(event) =>
                beginAdd("global", event.currentTarget as HTMLElement)
              }
              size="small"
              type="button"
            >
              + {t("addSchema")}
            </Button>
          </div>
          <div className="st-grid st-gap-base-45">
            {globalSchemas.length ? (
              cards(globalSchemas, "global")
            ) : (
              <div className="st-rounded-md st-border st-border-dashed st-border-elevation-250 st-bg-elevation-50 st-p-base st-text-center">
                <p>{t("noGlobalSchemas")}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        aria-labelledby="seo-schema-collection-tab"
        hidden={activeTab !== "collection"}
        id="seo-schema-collection-panel"
        role="tabpanel"
      >
        <div className="st-grid st-grid-cols-[minmax(150px,220px)_minmax(0,1fr)] st-items-start st-gap-base max-[600px]:st-grid-cols-1">
          <nav
            aria-label={t("enabledCollection")}
            className="st-grid st-gap-1 st-rounded-md st-border st-border-solid st-border-elevation-150 st-bg-elevation-50 st-p-1.5 max-[600px]:st-flex max-[600px]:st-overflow-x-auto [&_button]:st-cursor-pointer [&_button]:st-overflow-hidden [&_button]:st-text-ellipsis [&_button]:st-whitespace-nowrap [&_button]:st-rounded-sm [&_button]:st-border-0 [&_button]:st-bg-transparent [&_button]:st-p-base-55 [&_button]:st-text-left [&_button]:st-font-[inherit] [&_button]:st-text-elevation-700 [&_button:hover]:st-bg-elevation-100 [&_button:hover]:st-text-foreground max-[600px]:[&_button]:st-flex-none"
          >
            {collections.map((collection) => (
              <button
                aria-current={
                  selectedCollection === collection ? "page" : undefined
                }
                className={
                  selectedCollection === collection ? "!st-bg-elevation-800 !st-text-elevation-0" : undefined
                }
                key={collection}
                onClick={() => setSelectedCollection(collection)}
                type="button"
              >
                {collectionName(collection)}
              </button>
            ))}
          </nav>
          <div className="st-grid st-min-w-0 st-gap-base-70">
            <div className="st-flex st-items-center st-justify-between st-gap-base max-[600px]:st-flex-col max-[600px]:st-items-stretch">
              <div></div>
              <Button
                buttonStyle="primary"
                disabled={disabled || !selectedCollection}
                onClick={(event) =>
                  beginAdd("collection", event.currentTarget as HTMLElement)
                }
                size="small"
                type="button"
              >
                + {t("addSchema")}
              </Button>
            </div>
            <div className="st-grid st-gap-base-45">
              {templates.length ? (
                cards(templates, "collection")
              ) : (
                <div className="st-rounded-md st-border st-border-dashed st-border-elevation-250 st-bg-elevation-50 st-p-base st-text-center">
                  <p>{t("noCollectionSchemas")}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <SchemaDrawer
        onCancel={close}
        onSave={stage === "editor" ? save : undefined}
        saveDisabled={disabled || !draft?.name.trim()}
        slug={drawerSlug}
        title={editing ? t("editSchema") : t("addSchema")}
      >
        {stage === "picker" ? (
          <StarterPicker onChoose={chooseStarter} />
        ) : draft ? (
          <SchemaEditorPanel
            baseDraft={baseDraft}
            collectionTemplate={scope === "collection"}
            draft={draft}
            onChange={setDraft}
            onReplace={() => setStage("picker")}
            readOnly={readOnly}
            showLocalizedNotice={localized && Boolean(editing)}
            structuralLocked={localized && Boolean(editing)}
            variables={variables}
          />
        ) : null}
      </SchemaDrawer>
    </section>
  );
};
