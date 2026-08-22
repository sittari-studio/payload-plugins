'use client';

import {
  Button,
  useField,
  useForm,
  useLocale,
  useTranslation,
} from '@payloadcms/ui';
import { useState, type KeyboardEvent } from 'react';

import {
  joinUrl,
  normalizePath,
  permalinkDisplayPath,
  permalinkPrefix,
} from '../permalink.js';
import { formatPermalinkSlug } from '../slug.js';

type PermalinkFieldProps = {
  pathFieldName: string;
  prefix: string;
  siteUrl: string;
  slugFieldName: string;
  slugSourceFieldName: string;
};

const translations = {
  en: { cancel: 'Cancel', edit: 'Edit', label: 'Permalink', ok: 'OK' },
  ru: {
    cancel: 'Отмена',
    edit: 'Изменить',
    label: 'Постоянная ссылка',
    ok: 'OK',
  },
  uk: {
    cancel: 'Скасувати',
    edit: 'Змінити',
    label: 'Постійне посилання',
    ok: 'OK',
  },
} as const;

const styles = `
:where(.sittari-permalink-field) {
  align-items: center;
  background: var(--theme-elevation-50);
  border: 1px solid var(--theme-elevation-150);
  border-radius: var(--style-radius-s, 4px);
  display: flex;
  flex-wrap: wrap;
  gap: calc(var(--base) * 0.3);
  margin-bottom: var(--base);
  padding: calc(var(--base) * 0.45) calc(var(--base) * 0.6);
}

:where(.sittari-permalink-field__label) {
  color: var(--theme-elevation-600);
  font-weight: 600;
}

:where(.sittari-permalink-field__prefix) {
  overflow-wrap: anywhere;
}

:where(.sittari-permalink-field__link) {
  color: var(--theme-text);
  overflow-wrap: anywhere;
  text-decoration: underline;
  text-decoration-color: var(--theme-elevation-400);
  text-underline-offset: 2px;
}

:where(.sittari-permalink-field__placeholder) {
  color: var(--theme-elevation-500);
}

:where(.sittari-permalink-field__input) {
  background: var(--theme-input-bg);
  border: 1px solid var(--theme-elevation-250);
  border-radius: 3px;
  color: var(--theme-text);
  font: inherit;
  min-width: 12rem;
  padding: calc(var(--base) * 0.2) calc(var(--base) * 0.35);
}

:where(.sittari-permalink-field__error) {
  color: var(--theme-error-500);
  width: 100%;
}
`;

export const PermalinkField = ({
  pathFieldName,
  prefix,
  siteUrl,
  slugFieldName,
  slugSourceFieldName,
}: PermalinkFieldProps) => {
  const { value: pathValue } = useField<string>({ path: pathFieldName });
  const {
    disabled,
    errorMessage,
    setValue,
    showError,
    value: slugValue,
  } = useField<string>({ path: slugFieldName });
  const { getDataByPath } = useForm();
  const locale = useLocale();
  const { i18n } = useTranslation();
  const language = i18n.language.split('-')[0] as keyof typeof translations;
  const strings = translations[language] ?? translations.en;
  const slug = typeof slugValue === 'string' ? slugValue : '';
  const path = normalizePath(pathValue);
  const displayPath = permalinkDisplayPath(path, slug, prefix);
  const url = joinUrl(siteUrl, displayPath);
  const [draftSlug, setDraftSlug] = useState(slug);
  const [editing, setEditing] = useState(false);

  const beginEditing = () => {
    setDraftSlug(slug);
    setEditing(true);
  };

  const cancelEditing = () => {
    setDraftSlug(slug);
    setEditing(false);
  };

  const applySlug = () => {
    const valueToSlugify =
      draftSlug.length > 0 ? draftSlug : getDataByPath(slugSourceFieldName);
    const formatted =
      typeof valueToSlugify === 'string' && valueToSlugify.length > 0
        ? formatPermalinkSlug(valueToSlugify, locale.code)
        : '';

    setValue(formatted);
    setEditing(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      applySlug();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelEditing();
    }
  };

  const className = [
    'sittari-permalink-field',
    editing ? 'sittari-permalink-field--editing' : null,
    showError ? 'sittari-permalink-field--error' : null,
    disabled ? 'sittari-permalink-field--disabled' : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className}>
      <style>{styles}</style>
      <span className="sittari-permalink-field__label">{strings.label}:</span>
      {editing ? (
        <>
          <span className="sittari-permalink-field__prefix">
            {permalinkPrefix({ path, prefix, siteUrl })}
          </span>
          <input
            aria-label={strings.label}
            autoFocus
            className="sittari-permalink-field__input"
            onChange={(event) => setDraftSlug(event.target.value)}
            onKeyDown={handleKeyDown}
            value={draftSlug}
          />
          <Button
            buttonStyle="secondary"
            className="sittari-permalink-field__button sittari-permalink-field__button--ok"
            margin={false}
            onClick={applySlug}
            size="small"
          >
            {strings.ok}
          </Button>
          <Button
            buttonStyle="none"
            className="sittari-permalink-field__button sittari-permalink-field__button--cancel"
            margin={false}
            onClick={cancelEditing}
            size="small"
          >
            {strings.cancel}
          </Button>
        </>
      ) : (
        <>
          {path || slug ? (
            <a
              className="sittari-permalink-field__link"
              href={url}
              rel="noreferrer"
              target="_blank"
            >
              {url}
            </a>
          ) : (
            <span className="sittari-permalink-field__placeholder">{url}</span>
          )}
          {!disabled ? (
            <Button
              buttonStyle="secondary"
              className="sittari-permalink-field__button sittari-permalink-field__button--edit"
              margin={false}
              onClick={beginEditing}
              size="small"
            >
              {strings.edit}
            </Button>
          ) : null}
        </>
      )}
      {showError ? (
        <span className="sittari-permalink-field__error">
          {errorMessage ?? strings.label}
        </span>
      ) : null}
    </div>
  );
};
