import type { Config, SelectField } from 'payload';
import { describe, expect, it } from 'vitest';

import {
  localizedText,
  rbacPlugin,
  resolveLocalizedText,
  translate,
  translations,
} from '../src/index.js';

const baseConfig = (): Config =>
  ({
    admin: { user: 'users' },
    collections: [
      {
        slug: 'users',
        auth: true,
        fields: [],
        labels: {
          plural: { en: 'Users', ru: 'Пользователи', uk: 'Користувачі' },
          singular: { en: 'User', ru: 'Пользователь', uk: 'Користувач' },
        },
      },
    ],
    globals: [],
  }) as unknown as Config;

describe('RBAC localization', () => {
  it('keeps translation dictionaries in sync and normalizes admin languages', () => {
    expect(Object.keys(translations.ru)).toEqual(Object.keys(translations.en));
    expect(Object.keys(translations.uk)).toEqual(Object.keys(translations.en));
    expect(translate('permissions', 'uk-UA')).toBe('Дозволи');
    expect(translate('permissions', 'ru_RU')).toBe('Разрешения');
    expect(translate('permissions', 'de')).toBe('Permissions');
  });

  it('resolves localized Payload labels with an English fallback', () => {
    expect(resolveLocalizedText(localizedText('roles'), 'uk-UA')).toBe(
      'Ролі користувачів',
    );
    expect(resolveLocalizedText({ en: 'Fallback' }, 'ru')).toBe('Fallback');
    expect(resolveLocalizedText('Static label', 'uk')).toBe('Static label');
  });

  it('localizes generated fields, collection labels, and permission options', async () => {
    const config = await rbacPlugin()(baseConfig());
    const roles = config.collections?.find(({ slug }) => slug === 'roles');

    expect(roles?.labels).toEqual({
      plural: localizedText('roles'),
      singular: localizedText('role'),
    });

    const permissions = roles?.fields.find(
      (field): field is SelectField =>
        'name' in field &&
        field.name === 'permissions' &&
        field.type === 'select',
    );
    const fullAccess = permissions?.options.find(
      (option) => typeof option !== 'string' && option.value === '*',
    );
    const userRead = permissions?.options.find(
      (option) => typeof option !== 'string' && option.value === 'users:read',
    );

    expect(fullAccess).toMatchObject({ label: localizedText('fullAccess') });
    expect(userRead).toMatchObject({
      label: {
        en: 'Users: Read',
        ru: 'Пользователи: Чтение',
        uk: 'Користувачі: Читання',
      },
    });
  });
});
