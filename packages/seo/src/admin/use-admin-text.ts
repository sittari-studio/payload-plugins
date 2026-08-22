'use client';

import { useTranslation } from '@payloadcms/ui';

import { adminText, type AdminTextKey } from './translations.js';

/** Reads plugin copy from Payload's active Admin interface language. */
export const useAdminText = () => {
  const { i18n } = useTranslation();
  return (key: AdminTextKey, variables?: Record<string, string>) =>
    adminText(key, i18n.language, variables);
};
