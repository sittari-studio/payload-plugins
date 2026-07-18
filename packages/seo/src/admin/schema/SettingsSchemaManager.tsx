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
              className="is-danger"
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
            <span className="seo-schema-type-badge">
              {schemaTypeLabel(effectiveTemplate(template))}
            </span>
            <span className="seo-schema-scope-badge">
              {nextScope === "global"
                ? t("globalScope")
                : collectionName(selectedCollection)}
            </span>
            {template.isDefault ? (
              <span className="seo-schema-default-badge">{t("default")}</span>
            ) : null}
          </>
        }
        key={template.id ?? template.templateId}
        name={template.name}
      />
    ));

  return (
    <section className="seo-schema-manager">
      <div
        aria-label={t("schema")}
        className="seo-schema-settings-tabs"
        role="tablist"
      >
        {(["global", "collection"] as const).map((tab) => (
          <button
            aria-controls={`seo-schema-${tab}-panel`}
            aria-selected={activeTab === tab}
            className={activeTab === tab ? "is-active" : undefined}
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
        <div className="seo-schema-manager__group">
          <div className="seo-schema-manager__toolbar">
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
          <div className="seo-schema-card-list">
            {globalSchemas.length ? (
              cards(globalSchemas, "global")
            ) : (
              <div className="seo-schema-empty">
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
        <div className="seo-schema-collections-layout">
          <nav
            aria-label={t("enabledCollection")}
            className="seo-schema-collection-nav"
          >
            {collections.map((collection) => (
              <button
                aria-current={
                  selectedCollection === collection ? "page" : undefined
                }
                className={
                  selectedCollection === collection ? "is-active" : undefined
                }
                key={collection}
                onClick={() => setSelectedCollection(collection)}
                type="button"
              >
                {collectionName(collection)}
              </button>
            ))}
          </nav>
          <div className="seo-schema-collection-content">
            <div className="seo-schema-manager__toolbar">
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
            <div className="seo-schema-card-list">
              {templates.length ? (
                cards(templates, "collection")
              ) : (
                <div className="seo-schema-empty">
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
