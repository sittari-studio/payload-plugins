"use client";

import { useTranslation } from "@payloadcms/ui";

const messages = {
  en: 'For the home page, set the slug to "home".',
  ru: 'Для главной страницы установите слаг "home".',
  uk: 'Для головної сторінки встановіть слаг "home".',
} as const;

type SupportedLanguage = keyof typeof messages;

export function SlugInstruction() {
  const { i18n } = useTranslation();

  const language = i18n.language.split("-")[0] as SupportedLanguage;

  return (
    <div
      style={{
        marginTop: "-12px",
        marginBottom: "20px",
        color: "var(--theme-elevation-500)",
        fontSize: "13px",
        lineHeight: 1.4,
      }}
    >
      {messages[language] ?? messages.en}
    </div>
  );
}
