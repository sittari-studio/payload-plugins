import type { Config, Payload } from 'payload';
import { describe, expect, it } from 'vitest';

import {
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
