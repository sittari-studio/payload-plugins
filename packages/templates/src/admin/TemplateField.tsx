'use client';

import {
  GroupField,
  useConfig,
  useLocale,
  useTranslation,
} from '@payloadcms/ui';
import type { GroupFieldClientProps } from 'payload';
import { useEffect, useMemo, useState } from 'react';

import { translate } from '../translations/index.js';
import { applyTemplatePlaceholders } from './templatePlaceholders.js';

type TemplateFieldAdminCustom = {
  templateField?: {
    dataField?: unknown;
    template?: unknown;
  };
};

type TemplateDocument = {
  id?: number | string;
  [key: string]: unknown;
};

const joinURL = (base: string, path: string): string =>
  `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;

export const TemplateField = (props: GroupFieldClientProps) => {
  const { config } = useConfig();
  const locale = useLocale();
  const { i18n } = useTranslation();
  const custom = props.field.admin?.custom as
    | TemplateFieldAdminCustom
    | undefined;
  const template = custom?.templateField?.template;
  const dataField = custom?.templateField?.dataField;
  const localeCode =
    typeof locale?.code === 'string' && locale.code ? locale.code : undefined;
  const templateConfigured =
    typeof template === 'string' && typeof dataField === 'string';
  const [templateDocument, setTemplateDocument] = useState<TemplateDocument>();

  useEffect(() => {
    if (typeof template !== 'string' || typeof dataField !== 'string') {
      return;
    }

    const abortController = new AbortController();
    const params = new URLSearchParams({
      depth: '0',
      limit: '1',
      pagination: 'false',
      [`select[${dataField}]`]: 'true',
      'where[templateType][equals]': template,
    });
    if (localeCode) {
      params.set('locale', localeCode);
    }
    const endpoint = joinURL(
      config.serverURL,
      `${config.routes.api}/templates?${params.toString()}`,
    );

    void fetch(endpoint, {
      credentials: 'same-origin',
      signal: abortController.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          return undefined;
        }

        const result = (await response.json()) as { docs?: unknown[] };
        const document = result.docs?.[0];
        return document && typeof document === 'object'
          ? (document as TemplateDocument)
          : undefined;
      })
      .then(setTemplateDocument)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setTemplateDocument(undefined);
        }
      });

    return () => abortController.abort();
  }, [config.routes.api, config.serverURL, dataField, localeCode, template]);

  const field = useMemo(() => {
    const templateData =
      templateConfigured &&
      typeof dataField === 'string' &&
      templateDocument?.[dataField] &&
      typeof templateDocument[dataField] === 'object' &&
      !Array.isArray(templateDocument[dataField])
        ? (templateDocument[dataField] as Record<string, unknown>)
        : undefined;

    return templateData
      ? {
          ...props.field,
          fields: applyTemplatePlaceholders(props.field.fields, templateData),
        }
      : props.field;
  }, [dataField, props.field, templateConfigured, templateDocument]);

  const templateID = templateDocument?.id;
  const templateURL =
    templateID === undefined
      ? undefined
      : `${joinURL(
          config.routes.admin,
          `collections/templates/${encodeURIComponent(String(templateID))}`,
        )}${localeCode ? `?${new URLSearchParams({ locale: localeCode }).toString()}` : ''}`;

  return (
    <div className="template-field">
      {templateURL && (
        <div
          style={{ fontSize: '13px', marginBottom: '6px', textAlign: 'right' }}
        >
          <a href={templateURL}>{translate('editTemplate', i18n.language)}</a>
        </div>
      )}
      <GroupField {...props} field={field} />
    </div>
  );
};
