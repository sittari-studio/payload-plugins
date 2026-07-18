"use client";

import {
  Banner,
  Button,
  Card,
  formatDrawerSlug,
  Pill,
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
    <section className="st-mb-base-150 st-grid st-gap-base [&_.field-type]:st-mb-0 [&_h3]:st-m-0 [&_h4]:st-m-0 [&_p]:st-mt-[.35rem] [&_p]:st-mb-0 [&_p]:st-text-elevation-600">
      {loading ? <p>{t("loadingSchemas")}</p> : null}
      {loadError ? <Banner type="error">{loadError}</Banner> : null}
      {templates?.globalSchemas.length ? (
        <div className="st-grid st-gap-base-70">
          <h3>{t("appliedGlobally")}</h3>
          <p>{t("appliedGloballyDescription")}</p>
          <div className="st-grid st-gap-base-45">
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
                      <Button
                        buttonStyle="transparent"
                        disabled={readOnly}
                        margin={false}
                        onClick={(event) =>
                          openEditor(
                            { kind: "global", template },
                            event.currentTarget as HTMLElement,
                          )
                        }
                        type="button"
                      >
                        {t("editValues")}
                      </Button>
                      {customized ? (
                        <Button
                          buttonStyle="transparent"
                          disabled={readOnly}
                          margin={false}
                          onClick={() => resetGlobal(template.templateId)}
                          type="button"
                        >
                          {t("resetOverrides")}
                        </Button>
                      ) : null}
                      <span
                        className="st-px-1.5"
                        title={t("globalLocked")}
                      >
                        🔒
                      </span>
                    </>
                  }
                  badges={
                    <>
                      <Pill pillStyle="success" size="small">
                        {schemaTypeLabel(effective(template))}
                      </Pill>
                      <Pill pillStyle="light-gray" size="small">
                        {t("appliedGlobally")}
                      </Pill>
                      {customized ? (
                        <Pill pillStyle="light" size="small">
                          {t("customized")}
                        </Pill>
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
      <div className="st-grid st-gap-base-70">
        <div className="st-flex st-items-center st-justify-between st-gap-base max-[600px]:st-flex-col max-[600px]:st-items-stretch">
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
        <div className="st-grid st-gap-base-45">
          {instances.length ? (
            instances.map((instance, index) => {
              const template = byId.get(instance.templateId);
              const customized = Boolean(instance.overrides?.length);
              return (
                <SchemaCard
                  actions={
                    <>
                      {template ? (
                        <Button
                          buttonStyle="transparent"
                          disabled={readOnly}
                          margin={false}
                          onClick={(event) =>
                            openEditor(
                              { index, kind: "instance", template },
                              event.currentTarget as HTMLElement,
                            )
                          }
                          type="button"
                        >
                          {t("editValues")}
                        </Button>
                      ) : null}
                      <Button
                        buttonStyle="transparent"
                        disabled={readOnly}
                        margin={false}
                        onClick={() => duplicateInstance(index)}
                        type="button"
                      >
                        {t("duplicate")}
                      </Button>
                      <Button
                        buttonStyle="transparent"
                        disabled={readOnly || index === 0}
                        margin={false}
                        onClick={() => moveInstance(index, -1)}
                        type="button"
                      >
                        ↑
                      </Button>
                      <Button
                        buttonStyle="transparent"
                        disabled={readOnly || index === instances.length - 1}
                        margin={false}
                        onClick={() => moveInstance(index, 1)}
                        type="button"
                      >
                        ↓
                      </Button>
                      {customized ? (
                        <Button
                          buttonStyle="transparent"
                          disabled={readOnly}
                          margin={false}
                          onClick={() => resetInstance(index)}
                          type="button"
                        >
                          {t("resetOverrides")}
                        </Button>
                      ) : null}
                      <Button
                        buttonStyle="transparent"
                        className="!st-text-error-500 hover:!st-bg-error-100 hover:!st-text-error-700"
                        disabled={readOnly}
                        margin={false}
                        onClick={() => removeInstance(index)}
                        type="button"
                      >
                        {t("remove")}
                      </Button>
                    </>
                  }
                  badges={
                    <>
                      <Pill pillStyle="success" size="small">
                        {template
                          ? schemaTypeLabel(effective(template))
                          : t("missingTemplate")}
                      </Pill>
                      {template?.isDefault ? (
                        <Pill pillStyle="warning" size="small">
                          {t("default")}
                        </Pill>
                      ) : null}
                      {customized ? (
                        <Pill pillStyle="light" size="small">
                          {t("customized")}
                        </Pill>
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
            <Banner>{t("noSchemasInUse")}</Banner>
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
            <div className="st-flex st-items-center st-justify-between st-gap-base max-[600px]:st-flex-col max-[600px]:st-items-stretch">
              <div>
                <h3>{t("availableSchemas")}</h3>
                <p>{t("availableSchemasDescription")}</p>
              </div>
            </div>
            <div className="st-mt-base st-grid st-grid-cols-2 st-gap-base max-[850px]:st-grid-cols-1">
              {collectionTemplates.map((template) => {
                const count = instances.filter(
                  (item) => item.templateId === template.templateId,
                ).length;
                return (
                  <Card
                    actions={<Button buttonStyle="secondary" onClick={() => useTemplate(template)} size="small" type="button">{count ? t("useAgain") : t("use")}</Button>}
                    key={template.templateId}
                    title={`${template.name} · ${schemaTypeLabel(effective(template))}${template.isDefault ? ` · ${t("default")}` : ""}`}
                    titleAs="h4"
                  />
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
