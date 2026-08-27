import type {
  Config,
  Field,
  GlobalConfig,
  TabsField,
  TextField,
} from 'payload';
import { describe, expect, it } from 'vitest';

import { stringsPlugin } from '../src/index.js';

type ConfigInput = Record<string, unknown>;

const localization = {
  defaultLocale: 'en',
  locales: [
    { code: 'en', label: 'English' },
    { code: 'fr', label: 'Français' },
  ],
};

const runPlugin = (
  input: ConfigInput,
  pluginConfig?: Parameters<typeof stringsPlugin>[0],
): Config => stringsPlugin(pluginConfig)(input as never) as Config;

const tabsOf = (globalConfig?: GlobalConfig): TabsField =>
  globalConfig?.fields[0] as TabsField;

const getNamedField = (fields: Field[], name: string): Field | undefined =>
  fields.find((field) => 'name' in field && field.name === name);

const getNamedText = (fields: Field[], name: string): TextField | undefined => {
  const field = getNamedField(fields, name);
  return field?.type === 'text' ? field : undefined;
};

const afterChangeHook = () => {};

describe('stringsPlugin', () => {
  it('returns the incoming config unchanged when disabled', () => {
    const input = { collections: [], globals: [], localization };
    const output = runPlugin(input, { enabled: false });

    expect(output).toEqual(input);
  });

  it('allows being disabled without scopes', () => {
    expect(() =>
      runPlugin({ collections: [], localization }, { enabled: false }),
    ).not.toThrow();
  });

  it('appends the generated global and preserves existing globals', () => {
    const existingGlobal: GlobalConfig = {
      slug: 'settings',
      fields: [{ name: 'name', type: 'text' }],
    };
    const output = runPlugin(
      { collections: [], globals: [existingGlobal], localization },
      {
        scopes: {
          general: { labels: 'General', strings: { ok: {} } },
        },
      },
    );

    expect(output.globals).toHaveLength(2);
    expect(output.globals?.[0]).toBe(existingGlobal);
    expect(output.globals?.[1]?.slug).toBe('strings');
    // The global is labeled in English, Russian, and Ukrainian.
    expect(output.globals?.[1]?.label).toEqual({
      en: 'Translations',
      ru: 'Переводы',
      uk: 'Переклади',
    });
  });

  it('uses the default slug and respects a custom slug', () => {
    const scopes = {
      general: { labels: 'General', strings: { ok: {} } },
    };

    const withDefaultSlug = runPlugin(
      { collections: [], localization },
      { scopes },
    );
    const withCustomSlug = runPlugin(
      { collections: [], localization },
      { scopes, slug: 'ui-strings' },
    );

    expect(withDefaultSlug.globals?.[0]?.slug).toBe('strings');
    expect(withCustomSlug.globals?.[0]?.slug).toBe('ui-strings');
  });

  it('creates one named tab per scope with nested localized text fields', () => {
    const output = runPlugin(
      { collections: [], localization },
      {
        scopes: {
          general: {
            labels: 'General',
            strings: { cancelButton: {}, saveButton: {} },
          },
          auth: {
            labels: 'Authentication',
            strings: { loginTitle: {} },
          },
        },
      },
    );

    const tabs = tabsOf(output.globals?.[0]);

    expect(tabs.type).toBe('tabs');
    expect(
      tabs.tabs.map((tab) => ('name' in tab ? tab.name : undefined)),
    ).toEqual(['general', 'auth']);
    expect(tabs.tabs[0].label).toBe('General');
    expect(
      tabs.tabs[0].fields.map((field) =>
        'name' in field ? field.name : undefined,
      ),
    ).toEqual(['cancelButton', 'saveButton']);
    expect(getNamedText(tabs.tabs[0].fields, 'cancelButton')).toMatchObject({
      type: 'text',
      localized: true,
    });
    // Payload generates labels from the key; none are set explicitly.
    expect(
      getNamedText(tabs.tabs[0].fields, 'cancelButton')?.label,
    ).toBeUndefined();
    expect(tabs.tabs[1].label).toBe('Authentication');
  });

  it('preserves localized labels and descriptions', () => {
    const output = runPlugin(
      { collections: [], localization },
      {
        scopes: {
          general: {
            labels: { en: 'General', fr: 'Général' },
            strings: {
              welcomeMessage: {
                description: { en: 'Shown on the home page', fr: 'Accueil' },
              },
            },
          },
        },
      },
    );

    const tabs = tabsOf(output.globals?.[0]);
    expect(tabs.tabs[0].label).toEqual({ en: 'General', fr: 'Général' });
    expect(
      getNamedText(tabs.tabs[0].fields, 'welcomeMessage')?.admin?.description,
    ).toEqual({
      en: 'Shown on the home page',
      fr: 'Accueil',
    });
  });

  it('uses the configured defaultValue as the admin placeholder only', () => {
    const output = runPlugin(
      { collections: [], localization },
      {
        scopes: {
          general: {
            labels: 'General',
            strings: { cancelButton: { defaultValue: 'Cancel' } },
          },
        },
      },
    );

    const tabs = tabsOf(output.globals?.[0]);
    const field = getNamedText(tabs.tabs[0].fields, 'cancelButton');

    // Payload renders the placeholder in every locale; no defaults lifecycle.
    expect(field?.admin?.placeholder).toBe('Cancel');
    expect(field?.defaultValue).toBeUndefined();
    expect(field?.admin?.components).toBeUndefined();
  });

  it('runs overrides last and keeps the generated fields', () => {
    const output = runPlugin(
      { collections: [], localization },
      {
        scopes: {
          general: {
            labels: 'General',
            strings: { cancelButton: {} },
          },
        },
        overrides: (defaultGlobal) => ({
          ...defaultGlobal,
          access: {
            ...defaultGlobal.access,
            read: () => true,
          },
          hooks: {
            ...defaultGlobal.hooks,
            afterChange: [afterChangeHook],
          },
        }),
      },
    );

    const overridden = output.globals?.[0];
    expect(overridden?.slug).toBe('strings');
    expect(tabsOf(overridden)?.tabs[0].fields).toHaveLength(1);
    expect(overridden?.access?.read).toBeDefined();
    expect(overridden?.hooks?.afterChange?.[0]).toBe(afterChangeHook);
  });

  it('throws descriptive errors for invalid configurations', () => {
    expect(() => runPlugin({ collections: [] })).toThrowError(/localization/);

    expect(() => runPlugin({ collections: [], localization }, {})).toThrowError(
      /scope/,
    );

    expect(() =>
      runPlugin(
        { collections: [], localization },
        { scopes: { general: { labels: 'General', strings: {} } } },
      ),
    ).toThrowError(/at least one string/);

    expect(() =>
      runPlugin({ collections: [], localization }, { scopes: {} }),
    ).toThrowError(/scope/);
  });
});
