import type { Config, Payload } from 'payload';
import { describe, expect, it, vi } from 'vitest';

import {
  createTranslator,
  getStrings,
  getTranslations,
  stringsPlugin,
  STRINGS_RUNTIME_CONFIG_KEY,
} from '../src/index.js';

const localization = {
  defaultLocale: 'en',
  locales: [
    { code: 'en', label: 'English' },
    { code: 'fr', label: 'Français' },
  ],
};

const runPlugin = (
  input: Record<string, unknown>,
  pluginConfig?: Parameters<typeof stringsPlugin>[0],
): Config => stringsPlugin(pluginConfig)(input as never) as Config;

const runtimeScopes = {
  general: {
    labels: 'General',
    strings: {
      cancelButton: { defaultValue: 'Cancel' },
      saveButton: {},
    },
  },
};

const buildMockPayload = (
  findGlobal: Payload['findGlobal'],
): Payload =>
  ({
    config: {
      localization,
      custom: {
        [STRINGS_RUNTIME_CONFIG_KEY]: { slug: 'strings', scopes: runtimeScopes },
      },
    },
    findGlobal,
  }) as unknown as Payload;

describe('getTranslations discovery', () => {
  it('throws when the plugin is not part of the config', async () => {
    await expect(
      getTranslations({
        payload: { config: { localization, custom: {} } } as unknown as Payload,
        locale: 'en',
      }),
    ).rejects.toThrowError(/stringsPlugin/);
  });

  it('stores runtime metadata for helper discovery with the default slug', () => {
    const scopes = {
      general: { labels: 'General', strings: { ok: { defaultValue: 'OK' } } },
    };
    const output = runPlugin({ collections: [], localization }, { scopes });

    const metadata = output.custom?.[STRINGS_RUNTIME_CONFIG_KEY] as Record<
      string,
      unknown
    >;

    expect(metadata.slug).toBe('strings');
    expect(metadata.scopes).toBe(scopes);
  });

  it('stores the custom slug in the runtime metadata', () => {
    const output = runPlugin(
      { collections: [], localization },
      {
        scopes: { general: { labels: 'General', strings: { ok: {} } } },
        slug: 'ui-strings',
      },
    );

    const metadata = output.custom?.[STRINGS_RUNTIME_CONFIG_KEY] as Record<
      string,
      unknown
    >;

    expect(metadata.slug).toBe('ui-strings');
  });

  it('does not attach metadata when disabled', () => {
    const input = { collections: [], globals: [], localization };
    const output = stringsPlugin({ enabled: false })(input as never);

    expect(output).toEqual(input);
    expect((input as { custom?: unknown }).custom).toBeUndefined();
  });
});

describe('getStrings', () => {
  it('performs exactly one findGlobal call using locale "all"', async () => {
    const findGlobal = vi.fn().mockResolvedValue({});
    const payload = buildMockPayload(findGlobal);

    await getStrings({ payload });

    expect(findGlobal).toHaveBeenCalledTimes(1);
    expect(findGlobal).toHaveBeenCalledWith({
      slug: 'strings',
      locale: 'all',
      fallbackLocale: false,
    });
  });

  it('transforms the scopes-first response into a locale-first shape', async () => {
    const payload = buildMockPayload(
      vi.fn().mockResolvedValue({
        general: {
          cancelButton: { en: '', fr: 'Annuler' },
          saveButton: { en: 'Save changes', fr: null },
        },
      }),
    );

    expect(await getStrings({ payload })).toEqual({
      en: {
        general: { cancelButton: 'Cancel', saveButton: 'Save changes' },
      },
      fr: {
        general: { cancelButton: 'Annuler', saveButton: null },
      },
    });
  });

  it('replaces nullish and empty values with the defaultValue or null', async () => {
    const payload = buildMockPayload(
      vi.fn().mockResolvedValue({
        general: {
          cancelButton: { en: null, fr: undefined },
          saveButton: { en: '', fr: '   ' },
        },
      }),
    );

    const strings = await getStrings({ payload });

    // defaultValue wins for missing, null, and empty stored values.
    expect(strings.en.general.cancelButton).toBe('Cancel');
    expect(strings.fr.general.cancelButton).toBe('Cancel');
    // No defaultValue exists for saveButton.
    expect(strings.en.general.saveButton).toBeNull();
    // Whitespace-only strings stay valid values.
    expect(strings.fr.general.saveButton).toBe('   ');
  });
});

describe('createTranslator', () => {
  const strings = {
    en: {
      general: { cancelButton: 'Cancel', note: ' ', empty: null } as Record<
        string,
        string | null
      >,
    },
    fr: {
      general: { cancelButton: 'Annuler' } as Record<string, string | null>,
    },
  };

  it('resolves dot-separated scope keys and preserves whitespace values', () => {
    const t = createTranslator(strings, 'en');

    expect(t('general.cancelButton')).toBe('Cancel');
    expect(t('general.note')).toBe(' ');
    expect(t('general.empty')).toBeNull();
  });

  it('preserves the per-call locale override', () => {
    const t = createTranslator(strings, 'en');

    expect(t('general.cancelButton', 'fr')).toBe('Annuler');
    expect(t('general.cancelButton')).toBe('Cancel');
  });

  it('returns null for unknown scopes, keys, and locales', () => {
    const t = createTranslator(strings, 'en');

    expect(t('unknownScope.cancelButton')).toBeNull();
    expect(t('general.unknownKey')).toBeNull();
    expect(t('noScope')).toBeNull();
    expect(t('general.cancelButton', 'de')).toBeNull();
  });

  it('returns null when no locale is available at all', () => {
    const t = createTranslator(strings);

    expect(t('general.cancelButton')).toBeNull();
  });
});

describe('getTranslations composition', () => {
  it('uses the Payload defaultLocale when no option locale is given', async () => {
    const payload = buildMockPayload(
      vi.fn().mockResolvedValue({
        general: { saveButton: { en: 'Save changes' } },
      }),
    );
    const t = await getTranslations({ payload });

    expect(t('general.saveButton')).toBe('Save changes');
    expect(t('general.cancelButton')).toBe('Cancel');
  });

  it('prefers the option locale over the Payload defaultLocale', async () => {
    const payload = buildMockPayload(
      vi.fn().mockResolvedValue({
        general: { saveButton: { fr: 'Enregistrer' } },
      }),
    );
    const t = await getTranslations({ payload, locale: 'fr' });

    expect(t('general.saveButton')).toBe('Enregistrer');
  });
});
