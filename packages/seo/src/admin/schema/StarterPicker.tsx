"use client";

import { Button, TextareaInput } from "@payloadcms/ui";
import { useState } from "react";

import {
  createSchemaStarter,
  SEO_SCHEMA_STARTERS,
  type SeoSchemaStarter,
} from "../../schema/starters.js";
import {
  parseSchemaImport,
  removeManagedContext,
} from "../../schema/editor.js";
import type { JsonObject } from "../../schema/types.js";
import { useAdminText } from "../use-admin-text.js";

const STARTERS = Object.keys(SEO_SCHEMA_STARTERS) as SeoSchemaStarter[];

export const StarterPicker = ({
  onChoose,
}: {
  onChoose: (name: string, schema: JsonObject) => void;
}) => {
  const t = useAdminText();
  const [importing, setImporting] = useState(false);
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string>();
  const [contextSchema, setContextSchema] = useState<JsonObject>();

  const importJson = () => {
    const result = parseSchemaImport(raw);
    if (!result.ok) {
      setError(
        t(result.reason === "root" ? "validationSchemaRoot" : "validationJson"),
      );
      return;
    }
    if (result.hasManagedContext) {
      setContextSchema(result.schema);
      setError(t("importContextExplanation"));
      return;
    }
    onChoose(t("importedSchema"), result.schema);
  };

  if (importing)
    return (
      <div className="st-grid st-max-w-[820px] st-gap-base [&_h3]:st-m-0 [&_p]:st-mt-[.35rem] [&_p]:st-mb-0 [&_p]:st-text-elevation-600">
        <button
          className="st-w-max st-cursor-pointer st-rounded-sm st-border-0 st-bg-transparent st-px-2 st-py-1.5 st-text-foreground hover:st-bg-elevation-100"
          onClick={() => {
            setImporting(false);
            setError(undefined);
            setContextSchema(undefined);
          }}
          type="button"
        >
          ← {t("backToStarters")}
        </button>
        <h3 className="st-m-0">{t("importJson")}</h3>
        <p>{t("importJsonDescription")}</p>
        <TextareaInput
          className="[&_textarea]:st-min-h-[280px] [&_textarea]:st-w-full [&_textarea]:st-font-mono"
          label={t("rawJson")}
          onChange={(event) => {
            setRaw(event.target.value);
            setError(undefined);
            setContextSchema(undefined);
          }}
          path="seo-schema-import-json"
          rows={18}
          value={raw}
        />
        {error ? (
          <p
            className={`st-rounded-sm st-p-base-55 ${contextSchema ? "st-bg-warning-100 !st-text-warning-800" : "st-bg-error-100 !st-text-error-700"}`}
            role={contextSchema ? "status" : "alert"}
          >
            {error}
          </p>
        ) : null}
        <div className="st-flex st-flex-wrap st-items-center st-gap-1">
          {contextSchema ? (
            <Button
              buttonStyle="primary"
              onClick={() =>
                onChoose(
                  t("importedSchema"),
                  removeManagedContext(contextSchema),
                )
              }
              type="button"
            >
              {t("removeAndContinue")}
            </Button>
          ) : (
            <Button buttonStyle="primary" onClick={importJson} type="button">
              {t("continue")}
            </Button>
          )}
        </div>
      </div>
    );

  return (
    <div>
      <div className="st-flex st-items-center st-justify-between st-gap-base max-[600px]:st-flex-col max-[600px]:st-items-stretch [&_h3]:st-m-0 [&_p]:st-mt-[.35rem] [&_p]:st-mb-0 [&_p]:st-text-elevation-600">
        <div>
          <h3>{t("chooseStarter")}</h3>
          <p>{t("chooseStarterDescription")}</p>
        </div>
      </div>
      <div className="st-mt-base st-grid st-grid-cols-2 st-gap-base max-[850px]:st-grid-cols-1">
        {STARTERS.map((starter) => (
          <article
            className="st-flex st-min-h-[126px] st-items-end st-justify-between st-gap-base st-rounded-md st-border st-border-solid st-border-elevation-150 st-bg-elevation-0 st-p-base hover:st-border-elevation-400 hover:st-shadow-card"
            key={starter}
          >
            <h4 className="st-m-0">{starter}</h4>
            <Button
              buttonStyle="secondary"
              onClick={() => onChoose(starter, createSchemaStarter(starter))}
              size="small"
              type="button"
            >
              {t("use")}
            </Button>
          </article>
        ))}
        <article className="st-flex st-min-h-[126px] st-items-end st-justify-between st-gap-base st-rounded-md st-border st-border-solid st-border-elevation-150 st-bg-elevation-0 st-p-base hover:st-border-elevation-400 hover:st-shadow-card">
          <div>
            <h4>{t("startScratch")}</h4>
            <p>{t("startScratchDescription")}</p>
          </div>
          <Button
            buttonStyle="secondary"
            onClick={() => onChoose(t("untitledSchema"), {})}
            size="small"
            type="button"
          >
            {t("use")}
          </Button>
        </article>
        <article className="st-flex st-min-h-[126px] st-items-end st-justify-between st-gap-base st-rounded-md st-border st-border-solid st-border-elevation-150 st-bg-elevation-0 st-p-base hover:st-border-elevation-400 hover:st-shadow-card">
          <div>
            <h4>{t("importJson")}</h4>
            <p>{t("importJsonDescription")}</p>
          </div>
          <Button
            buttonStyle="secondary"
            onClick={() => setImporting(true)}
            size="small"
            type="button"
          >
            {t("use")}
          </Button>
        </article>
      </div>
    </div>
  );
};
