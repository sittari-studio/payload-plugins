import type { CollectionConfig, Option } from 'payload';

import type { MatrixRow } from '../shared.js';

import { FULL_ACCESS, permissionFor } from '../permissions.js';
import { collectionActions, permissionsMatrixFieldPath } from '../shared.js';
import type {
  RbacLanguage,
  RbacTranslationKey,
} from '../translations/index.js';
import {
  localizedText,
  resolveLocalizedText,
  translate,
  translations,
} from '../translations/index.js';

export type CreateRolesCollectionArgs = {
  access: CollectionConfig['access'];
  hooks?: CollectionConfig['hooks'];
  matrixRows: MatrixRow[];
  override?: (collection: CollectionConfig) => CollectionConfig;
  /** Names of code-locked roles; the matrix renders read-only for them. */
  protectedRoleNames?: string[];
  slug: string;
};

const localizedPermissionLabel = (
  label: MatrixRow['label'],
  key: RbacTranslationKey,
): Record<RbacLanguage, string> =>
  Object.fromEntries(
    Object.keys(translations).map((language) => [
      language,
      `${resolveLocalizedText(label, language)}: ${translate(key, language)}`,
    ]),
  ) as Record<RbacLanguage, string>;

/**
 * Builds the roles collection. Permissions are stored as an array of
 * `'<slug>:<action>'` strings (plus `'*'` and the `'<slug>:*'`/`'*:<action>'`
 * wildcards) in a `select` field, so every value is validated against the known
 * collections and globals; the admin UI renders them through the plugin's
 * checkbox-matrix field component.
 */
export const createRolesCollection = ({
  slug,
  access,
  hooks,
  matrixRows,
  override,
  protectedRoleNames = [],
}: CreateRolesCollectionArgs): CollectionConfig => {
  const options: Option[] = [
    { label: localizedText('fullAccess'), value: FULL_ACCESS },
    ...collectionActions.map((action) => ({
      label: localizedPermissionLabel(localizedText('everything'), action),
      value: `*:${action}`,
    })),
    ...matrixRows.flatMap((row) => [
      {
        label: localizedPermissionLabel(row.label, 'allActions'),
        value: `${row.slug}:*`,
      },
      ...row.actions.map((action) => ({
        label: localizedPermissionLabel(row.label, action),
        value: permissionFor(row.slug, action),
      })),
    ]),
  ];

  const collection: CollectionConfig = {
    slug,
    access,
    admin: {
      defaultColumns: ['name', 'description'],
      description: localizedText('rolesCollectionDescription'),
      useAsTitle: 'name',
    },
    fields: [
      {
        name: 'name',
        type: 'text',
        index: true,
        label: localizedText('name'),
        required: true,
        unique: true,
      },
      {
        name: 'description',
        type: 'textarea',
        label: localizedText('description'),
      },
      {
        name: 'permissions',
        type: 'select',
        admin: {
          components: {
            Field: {
              clientProps: { protectedRoleNames, rows: matrixRows },
              path: permissionsMatrixFieldPath,
            },
          },
        },
        hasMany: true,
        label: localizedText('permissions'),
        options,
      },
    ],
    hooks,
    labels: {
      plural: localizedText('roles'),
      singular: localizedText('role'),
    },
  };

  return override ? override(collection) : collection;
};
