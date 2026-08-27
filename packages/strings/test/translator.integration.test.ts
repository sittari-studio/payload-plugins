import { sqliteAdapter } from '@payloadcms/db-sqlite';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildConfig, getPayload, type Payload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createTranslator,
  getStrings,
  getTranslations,
  stringsPlugin,
} from '../src/index.js';

const databaseFile = join(tmpdir(), `payload-strings-t-${randomUUID()}.sqlite`);
const customSlugFile = join(
  tmpdir(),
  `payload-strings-c-${randomUUID()}.sqlite`,
);
let payload: Payload;
let customSlugPayload: Payload;

const scopes = {
  general: {
    labels: 'General',
    strings: {
      cancelButton: { defaultValue: 'Cancel' },
      saveButton: {},
      welcome: { defaultValue: 'Welcome' },
    },
  },
  auth: {
    labels: 'Auth',
    strings: { loginTitle: {} },
  },
};

const buildTestConfig = async ({
  dbUrl,
  slug,
  secret,
}: {
  dbUrl: string;
  secret: string;
  slug?: string;
}) =>
  buildConfig({
    secret,
    db: sqliteAdapter({
      client: { url: dbUrl },
      push: true,
      transactionOptions: {},
    }),
    localization: {
      defaultLocale: 'en',
      fallback: false,
      locales: [
        { code: 'en', label: 'English' },
        { code: 'fr', label: 'Français' },
      ],
    },
    collections: [],
    plugins: [stringsPlugin({ scopes, ...(slug ? { slug } : {}) })],
  });

beforeAll(async () => {
  payload = await getPayload({
    config: await buildTestConfig({
      dbUrl: `file:${databaseFile}`,
      secret: 'payload-strings-translator-secret',
    }),
    key: `strings-translator-${databaseFile}`,
  });

  customSlugPayload = await getPayload({
    config: await buildTestConfig({
      dbUrl: `file:${customSlugFile}`,
      secret: 'payload-strings-custom-slug-secret',
      slug: 'ui-strings',
    }),
    key: `strings-translator-${customSlugFile}`,
  });

  await payload.updateGlobal({
    slug: 'strings',
    locale: 'en',
    data: {
      general: { cancelButton: '', saveButton: 'Save changes' },
      auth: { loginTitle: 'Sign in' },
    },
  });

  await payload.updateGlobal({
    slug: 'strings',
    locale: 'fr',
    data: {
      general: { cancelButton: 'Annuler' },
      auth: { loginTitle: 'Connexion' },
    },
  });

  await customSlugPayload.updateGlobal({
    slug: 'ui-strings',
    locale: 'en',
    data: { auth: { loginTitle: 'Custom sign in' } },
  });
});

afterAll(async () => {
  await payload.db.destroy?.();
  await customSlugPayload.db.destroy?.();
  await rm(databaseFile, { force: true });
  await rm(customSlugFile, { force: true });
});

describe('getStrings', () => {
  it('returns a locale-first table covering every configured locale', async () => {
    const strings = await getStrings({ payload });

    expect(Object.keys(strings)).toEqual(['en', 'fr']);

    expect(strings.en.general).toEqual({
      // Stored '' is normalized to the configured defaultValue.
      cancelButton: 'Cancel',
      saveButton: 'Save changes',
      welcome: 'Welcome',
    });
    expect(strings.en.auth.loginTitle).toBe('Sign in');

    expect(strings.fr.general).toEqual({
      cancelButton: 'Annuler',
      saveButton: null,
      welcome: 'Welcome',
    });
    expect(strings.fr.auth.loginTitle).toBe('Connexion');
  });

  it('keeps locales isolated in the normalized table', async () => {
    const strings = await getStrings({ payload });

    // French has no saveButton value and Payload fallback is disabled.
    expect(strings.fr.general.saveButton).toBeNull();
    expect(strings.en.general.saveButton).toBe('Save changes');
  });
});

describe('createTranslator', () => {
  it('translates directly from a getStrings table with a locale override', async () => {
    const strings = await getStrings({ payload });

    const t = createTranslator(strings, 'en');
    expect(t('general.saveButton')).toBe('Save changes');
    expect(t('general.saveButton', 'fr')).toBeNull();

    const tf = createTranslator(strings, 'fr');
    expect(tf('general.cancelButton')).toBe('Annuler');
  });
});

describe('getTranslations', () => {
  it('resolves stored values for the default locale', async () => {
    const t = await getTranslations({ payload, locale: 'en' });

    expect(t('general.saveButton')).toBe('Save changes');
    expect(t('auth.loginTitle')).toBe('Sign in');
  });

  it('returns the configured defaultValue when the stored value is empty or missing', async () => {
    const t = await getTranslations({ payload, locale: 'en' });

    expect(t('general.cancelButton')).toBe('Cancel');
    expect(t('general.welcome')).toBe('Welcome');
  });

  it('falls back to the defaultValue even in other locales without translations', async () => {
    const t = await getTranslations({ payload, locale: 'fr' });

    expect(t('general.cancelButton')).toBe('Annuler');
    expect(t('general.welcome')).toBe('Welcome');
  });

  it('looks up an explicit locale per call', async () => {
    const t = await getTranslations({ payload, locale: 'en' });

    expect(t('general.cancelButton', 'fr')).toBe('Annuler');
    expect(t('auth.loginTitle', 'fr')).toBe('Connexion');
  });

  it('keeps locales isolated because Payload fallback is disabled', async () => {
    const t = await getTranslations({ payload, locale: 'fr' });

    expect(t('general.saveButton')).toBeNull();
    expect(t('general.saveButton', 'en')).toBe('Save changes');
  });

  it('returns null when no value and no defaultValue exist', async () => {
    const t = await getTranslations({ payload, locale: 'fr' });

    expect(t('general.saveButton')).toBeNull();
    expect(t('auth.loginTitle', 'de')).toBeNull();
  });

  it('returns null for unknown keys', async () => {
    const t = await getTranslations({ payload, locale: 'en' });

    expect(t('general.unknownKey')).toBeNull();
    expect(t('unknownScope.cancelButton')).toBeNull();
    expect(t('noScope')).toBeNull();
  });

  it('discovers globals registered under a custom slug', async () => {
    const t = await getTranslations({
      payload: customSlugPayload,
      locale: 'en',
    });

    expect(t('auth.loginTitle')).toBe('Custom sign in');

    // The custom-slug instance never saved to the default global.
    expect(t('general.saveButton')).toBeNull();
  });
});
