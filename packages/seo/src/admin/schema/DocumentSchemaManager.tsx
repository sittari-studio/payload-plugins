"use client";

import {
  Button,
  FieldLabel,
  formatDrawerSlug,
  useConfig,
  useDocumentInfo,
  useLocale,
  useModal,
} from "@payloadcms/ui";
import { useDrawerDepth } from "@payloadcms/ui/elements/Drawer";
import { useEffect, useMemo, useRef, useState } from "react";
import type { UIFieldClientProps } from "payload";

import "../../admin.css";
import { diffEffectiveSchema } from "../../schema/editor.js";
import { applyJsonPatch } from "../../schema/json.js";
import type { JsonObject } from "../../schema/types.js";
import { useAdminText } from "../use-admin-text.js";
import { SchemaCard } from "./SchemaCard.js";
import { SchemaDrawer } from "./SchemaDrawer.js";
import { SchemaEditorPanel } from "./SchemaEditorPanel.js";
import {
  createClientId,
  isLocalizedSchemaLocale,
  schemaTypeLabel,
  type EditorDraft,
  type SchemaManagerCustom,
  type StoredGlobalOverride,
  type StoredSchemaInstance,
  type StoredSchemaTemplate,
  type TemplateEndpointResponse,
} from "./types.js";
import { usePayloadArray } from "./usePayloadArray.js";

type EditTarget =
  | { kind: "global"; template: StoredSchemaTemplate }
  | { index: number; kind: "instance"; template: StoredSchemaTemplate };

const effective = (
  template: StoredSchemaTemplate,
  overrides?: StoredSchemaInstance["overrides"],
): JsonObject => {
  try {
    const localized = applyJsonPatch(template.schema, template.valueOverrides);
    return applyJsonPatch(localized, overrides);
  } catch {
    return structuredClone(template.schema);
  }
};

const templateDraft = (
  template: StoredSchemaTemplate,
  schema = effective(template),
): EditorDraft => ({
  name: template.name,
  schema,
  templateId: template.templateId,
  isDefault: template.isDefault,
});

export const DocumentSchemaManager = ({
  field,
  path: incomingPath,
  readOnly,
}: UIFieldClientProps) => {
  const t = useAdminText();
  const path = incomingPath ?? "schemaManager";
  const parentPath = path.replace(/\.schemaManager$/, "");
  const custom = field.admin?.custom?.seo as SchemaManagerCustom | undefined;
  const collection = custom?.collection ?? "";
  const { config } = useConfig();
  const locale = useLocale();
  const document = useDocumentInfo();
  const instancesArray = usePayloadArray<StoredSchemaInstance>({
    path: `${parentPath}.schemaInstances`,
  });
  const globalsArray = usePayloadArray<StoredGlobalOverride>({
    path: `${parentPath}.globalSchemaOverrides`,
  });
  const instances = instancesArray.rows;
  const globalOverrides = globalsArray.rows;
  const [templates, setTemplates] = useState<TemplateEndpointResponse>();
  const [loadError, setLoadError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<"editor" | "templates">("templates");
  const [editTarget, setEditTarget] = useState<EditTarget>();
  const [draft, setDraft] = useState<EditorDraft>();
  const [baseDraft, setBaseDraft] = useState<EditorDraft>();
  const returnFocus = useRef<HTMLElement | null>(null);
  const { closeModal, openModal } = useModal();
  const drawerDepth = useDrawerDepth();
  const drawerSlug = useMemo(
    () =>
      formatDrawerSlug({
        depth: drawerDepth + 1,
        slug: `seo-document-schema-${path}`,
      }),
    [drawerDepth, path],
  );
  // Structural document patches cannot be localized safely. Documents may only replace scalar values.
  const structuralLocked = true;

  useEffect(() => {
    if (!collection) return;
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (locale.code) params.set("locale", locale.code);
    if (document.id !== undefined) params.set("id", String(document.id));
    setLoading(true);
    setLoadError(undefined);
    fetch(
      `${custom?.apiRoute ?? "/api"}/${collection}/seo-schema-templates?${params}`,
      { credentials: "include", signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            response.status === 403
              ? t("schemaAccessDenied")
              : t("schemaLoadFailed"),
          );
        return response.json() as Promise<TemplateEndpointResponse>;
      })
      .then((result) => setTemplates(result))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError"))
          setLoadError(
            error instanceof Error ? error.message : t("schemaLoadFailed"),
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [collection, custom?.apiRoute, document.id, locale.code]);

  const close = () => {
    closeModal(drawerSlug);
    requestAnimationFrame(() => returnFocus.current?.focus());
  };
  const openTemplates = (element: HTMLElement) => {
    returnFocus.current = element;
    setStage("templates");
    setEditTarget(undefined);
    setDraft(undefined);
    openModal(drawerSlug);
  };
  const openEditor = (target: EditTarget, element: HTMLElement) => {
    const overrides =
      target.kind === "global"
        ? globalOverrides.find(
            (item) => item.schemaId === target.template.templateId,
          )?.overrides
        : instances[target.index]?.overrides;
    const base = effective(target.template);
    returnFocus.current = element;
    setEditTarget(target);
    setBaseDraft(templateDraft(target.template, base));
    setDraft(
      templateDraft(target.template, effective(target.template, overrides)),
    );
    setStage("editor");
    openModal(drawerSlug);
  };
  const useTemplate = (template: StoredSchemaTemplate) => {
    instancesArray.add({
      id: createClientId(),
      templateId: template.templateId,
    });
    close();
  };
  const save = () => {
    if (!editTarget || !draft || !baseDraft) return;
    const overrides = diffEffectiveSchema(baseDraft.schema, draft.schema, {
      scalarValuesOnly: structuralLocked,
    });
    if (editTarget.kind === "instance") {
      instancesArray.replace(editTarget.index, {
        ...instances[editTarget.index],
        overrides: overrides.length ? overrides : undefined,
      });
    } else {
      const index = globalOverrides.findIndex(
        (item) => item.schemaId === editTarget.template.templateId,
      );
      if (!overrides.length && index >= 0) globalsArray.remove(index);
      else if (overrides.length && index >= 0)
        globalsArray.replace(index, { ...globalOverrides[index], overrides });
      else if (overrides.length)
        globalsArray.add({
          id: createClientId(),
          schemaId: editTarget.template.templateId,
          overrides,
        });
    }
    close();
  };
  const resetInstance = (index: number) =>
    instancesArray.replace(index, {
      ...instances[index],
      overrides: undefined,
    });
  const removeInstance = (index: number) => instancesArray.remove(index);
  const moveInstance = (index: number, direction: -1 | 1) =>
    instancesArray.move(index, index + direction);
  const duplicateInstance = (index: number) =>
    instancesArray.add(
      { ...structuredClone(instances[index]), id: createClientId() },
      index + 1,
    );
  const resetGlobal = (schemaId: string) => {
    const index = globalOverrides.findIndex(
      (item) => item.schemaId === schemaId,
    );
    if (index >= 0) globalsArray.remove(index);
  };
  const collectionTemplates = templates?.collectionTemplates ?? [];
  const localized = isLocalizedSchemaLocale({
    defaultLocale: templates?.defaultLocale,
    locale: locale.code,
    localization: config.localization,
  });
  const byId = new Map(
    collectionTemplates.map((template) => [template.templateId, template]),
  );

  return (
    <section className="seo-schema-manager">
      {loading ? <p>{t("loadingSchemas")}</p> : null}
      {loadError ? (
        <p className="seo-schema-error" role="alert">
          {loadError}
        </p>
      ) : null}
      {templates?.globalSchemas.length ? (
        <div className="seo-schema-manager__group">
          <h3>{t("appliedGlobally")}</h3>
          <p>{t("appliedGloballyDescription")}</p>
          <div className="seo-schema-card-list">
            {templates.globalSchemas.map((template) => {
              const customized = globalOverrides.some(
                (item) =>
                  item.schemaId === template.templateId &&
                  item.overrides?.length,
              );
              return (
                <SchemaCard
                  actions={
                    <>
                      <button
                        disabled={readOnly}
                        onClick={(event) =>
                          openEditor(
                            { kind: "global", template },
                            event.currentTarget,
                          )
                        }
                        type="button"
                      >
                        {t("editValues")}
                      </button>
                      {customized ? (
                        <button
                          disabled={readOnly}
                          onClick={() => resetGlobal(template.templateId)}
                          type="button"
                        >
                          {t("resetOverrides")}
                        </button>
                      ) : null}
                      <span
                        className="seo-schema-lock"
                        title={t("globalLocked")}
                      >
                        🔒
                      </span>
                    </>
                  }
                  badges={
                    <>
                      <span className="seo-schema-type-badge">
                        {schemaTypeLabel(effective(template))}
                      </span>
                      <span className="seo-schema-scope-badge">
                        {t("appliedGlobally")}
                      </span>
                      {customized ? (
                        <span className="seo-schema-custom-badge">
                          {t("customized")}
                        </span>
                      ) : null}
                    </>
                  }
                  key={template.templateId}
                  name={template.name}
                />
              );
            })}
          </div>
        </div>
      ) : null}
      <div className="seo-schema-manager__group">
        <div className="seo-schema-manager__toolbar">
          <div>
            <h3>{t("schemaInUse")}</h3>
            <p>{t("schemaInUseDescription")}</p>
          </div>
          <Button
            buttonStyle="primary"
            disabled={readOnly || loading || Boolean(loadError)}
            onClick={(event) =>
              openTemplates(event.currentTarget as HTMLElement)
            }
            size="small"
            type="button"
          >
            + {t("addSchema")}
          </Button>
        </div>
        <div className="seo-schema-card-list">
          {instances.length ? (
            instances.map((instance, index) => {
              const template = byId.get(instance.templateId);
              const customized = Boolean(instance.overrides?.length);
              return (
                <SchemaCard
                  actions={
                    <>
                      {template ? (
                        <button
                          disabled={readOnly}
                          onClick={(event) =>
                            openEditor(
                              { index, kind: "instance", template },
                              event.currentTarget,
                            )
                          }
                          type="button"
                        >
                          {t("editValues")}
                        </button>
                      ) : null}
                      <button
                        disabled={readOnly}
                        onClick={() => duplicateInstance(index)}
                        type="button"
                      >
                        {t("duplicate")}
                      </button>
                      <button
                        disabled={readOnly || index === 0}
                        onClick={() => moveInstance(index, -1)}
                        type="button"
                      >
                        ↑
                      </button>
                      <button
                        disabled={readOnly || index === instances.length - 1}
                        onClick={() => moveInstance(index, 1)}
                        type="button"
                      >
                        ↓
                      </button>
                      {customized ? (
                        <button
                          disabled={readOnly}
                          onClick={() => resetInstance(index)}
                          type="button"
                        >
                          {t("resetOverrides")}
                        </button>
                      ) : null}
                      <button
                        className="is-danger"
                        disabled={readOnly}
                        onClick={() => removeInstance(index)}
                        type="button"
                      >
                        {t("remove")}
                      </button>
                    </>
                  }
                  badges={
                    <>
                      <span className="seo-schema-type-badge">
                        {template
                          ? schemaTypeLabel(effective(template))
                          : t("missingTemplate")}
                      </span>
                      {template?.isDefault ? (
                        <span className="seo-schema-default-badge">
                          {t("default")}
                        </span>
                      ) : null}
                      {customized ? (
                        <span className="seo-schema-custom-badge">
                          {t("customized")}
                        </span>
                      ) : null}
                    </>
                  }
                  key={instance.id ?? `${instance.templateId}:${index}`}
                  name={template?.name ?? t("missingTemplate")}
                  subtitle={
                    template ? undefined : t("missingTemplateDescription")
                  }
                />
              );
            })
          ) : (
            <div className="seo-schema-empty">
              <p>{t("noSchemasInUse")}</p>
            </div>
          )}
        </div>
      </div>
      <SchemaDrawer
        onCancel={close}
        onSave={stage === "editor" ? save : undefined}
        saveDisabled={readOnly}
        slug={drawerSlug}
        title={stage === "templates" ? t("chooseSchema") : t("editValues")}
      >
        {stage === "templates" ? (
          <div>
            <div className="seo-schema-section-heading">
              <div>
                <h3>{t("availableSchemas")}</h3>
                <p>{t("availableSchemasDescription")}</p>
              </div>
            </div>
            <div className="seo-schema-starter-grid">
              {collectionTemplates.map((template) => {
                const count = instances.filter(
                  (item) => item.templateId === template.templateId,
                ).length;
                return (
                  <article
                    className="seo-schema-starter-card"
                    key={template.templateId}
                  >
                    <div>
                      <span className="seo-schema-type-badge">
                        {schemaTypeLabel(effective(template))}
                      </span>
                      <h4>{template.name}</h4>
                      {template.isDefault ? (
                        <span className="seo-schema-default-badge">
                          {t("default")}
                        </span>
                      ) : null}
                    </div>
                    <Button
                      buttonStyle="secondary"
                      onClick={() => useTemplate(template)}
                      size="small"
                      type="button"
                    >
                      {count ? t("useAgain") : t("use")}
                    </Button>
                  </article>
                );
              })}
            </div>
          </div>
        ) : draft ? (
          <SchemaEditorPanel
            baseDraft={baseDraft}
            draft={draft}
            onChange={setDraft}
            readOnly={readOnly}
            showLocalizedNotice={localized}
            structuralLocked={structuralLocked}
            variables={custom?.collectionVariables?.[collection] ?? []}
          />
        ) : null}
      </SchemaDrawer>
    </section>
  );
};
