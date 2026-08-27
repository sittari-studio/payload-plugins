import type { GlobalConfig, TabsField, TextField } from 'payload';

import { localizedText } from '../translations/index.js';
import type { StringsScopes, StringsString } from '../types.js';

const createStringField = (
  key: string,
  definition: StringsString,
): TextField => {
  const { defaultValue, description } = definition;

  const admin: TextField['admin'] = {
    ...(description === undefined ? {} : { description }),
    ...(defaultValue === undefined ? {} : { placeholder: defaultValue }),
  };

  return {
    name: key,
    type: 'text',
    localized: true,
    ...(Object.keys(admin).length === 0 ? {} : { admin }),
  };
};

const createScopeTabs = (scopes: StringsScopes): TabsField['tabs'] =>
  Object.entries(scopes).map(([name, scope]) => ({
    name,
    label: scope.labels,
    fields: Object.entries(scope.strings).map(([key, definition]) =>
      createStringField(key, definition),
    ),
  }));

export const createStringsGlobal = ({
  scopes,
  slug,
}: {
  scopes: StringsScopes;
  slug: string;
}): GlobalConfig => {
  const tabsField: TabsField = {
    type: 'tabs',
    tabs: createScopeTabs(scopes),
  };

  return {
    label: localizedText('translations'),
    slug,
    fields: [tabsField],
  };
};
