import { sqliteAdapter } from '@payloadcms/db-sqlite';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildConfig, getPayload, type Payload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { stringsPlugin } from '../src/index.js';

const databaseFile = join(tmpdir(), `payload-strings-${randomUUID()}.sqlite`);
let payload: Payload;

const scopes = {
  auth: {
    labels: { en: 'Authentication', fr: 'Authentification' },
    strings: {
      loginTitle: {},
    },
  },
  general: {
    labels: { en: 'General', fr: 'Général' },
    strings: {
      cancelButton: {
        defaultValue: 'Cancel',
        description: { en: 'Cancel button label', fr: 'Libellé du bouton' },
      },
      saveButton: {},
    },
  },
};

beforeAll(async () => {
  const config = await buildConfig({
    secret: 'payload-strings-integration-secret',
    db: sqliteAdapter({
      client: { url: `file:${databaseFile}` },
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
    plugins: [stringsPlugin({ scopes })],
  });

  payload = await getPayload({
    config,
    key: `strings-integration-${databaseFile}`,
  });
});

afterAll(async () => {
  await payload.db.destroy?.();
  await rm(databaseFile, { force: true });
});

describe('strings global persistence', () => {
  it('exposes an empty global through nested properties before anything is saved', async () => {
    const result = await payload.findGlobal({
      slug: 'strings',
      locale: 'en',
      fallbackLocale: false,
    });

    // defaultValue only feeds the admin placeholder; nothing is pre-filled.
    expect(result.general?.cancelButton ?? null).toBeNull();
    expect(result.auth?.loginTitle ?? null).toBeNull();
  });

  it('saves values into nested properties without overwriting explicit empties', async () => {
    await payload.updateGlobal({
      slug: 'strings',
      locale: 'en',
      data: {
        general: { cancelButton: '', saveButton: 'Save changes' },
        auth: { loginTitle: 'Sign in' },
      },
    });

    const english = await payload.findGlobal({
      slug: 'strings',
      locale: 'en',
      fallbackLocale: false,
    });

    expect(english.general).toMatchObject({
      cancelButton: '',
      saveButton: 'Save changes',
    });
    expect(english.auth.loginTitle).toBe('Sign in');

    await payload.updateGlobal({
      slug: 'strings',
      locale: 'en',
      data: {
        general: { saveButton: 'Persisted' },
      },
    });

    const updated = await payload.findGlobal({
      slug: 'strings',
      locale: 'en',
      fallbackLocale: false,
    });

    expect(updated.general.saveButton).toBe('Persisted');
    expect(updated.general.cancelButton).toBe('');
  });

  it('stores localized values per locale independently', async () => {
    await payload.updateGlobal({
      slug: 'strings',
      locale: 'fr',
      data: {
        auth: { loginTitle: 'Connexion' },
        general: { cancelButton: 'Annuler' },
      },
    });

    const french = await payload.findGlobal({
      slug: 'strings',
      locale: 'fr',
      fallbackLocale: false,
    });

    expect(french.general.cancelButton).toBe('Annuler');
    expect(french.auth.loginTitle).toBe('Connexion');

    const english = await payload.findGlobal({
      slug: 'strings',
      locale: 'en',
      fallbackLocale: false,
    });

    expect(english.general.cancelButton).toBe('');
    expect(english.auth.loginTitle).toBe('Sign in');
  });

  it('falls back to the default locale when requested', async () => {
    const withFallback = await payload.findGlobal({
      slug: 'strings',
      locale: 'fr',
      fallbackLocale: 'en',
    });

    // cancelButton has a French value; saveButton was never translated.
    expect(withFallback.general.cancelButton).toBe('Annuler');
    expect(withFallback.general.saveButton).toBe('Persisted');
  });
});
