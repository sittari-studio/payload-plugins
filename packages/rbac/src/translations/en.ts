export const en = {
  all: 'All',
  allActions: 'all actions',
  collectionOrGlobal: 'Collection or global',
  collections: 'Collections',
  create: 'Create',
  delete: 'Delete',
  description: 'Description',
  everything: 'Everything',
  fullAccess: 'Full access',
  fullAccessDescription:
    'Full access — every action on every collection and global, including ones added in the future',
  globals: 'Globals',
  invalidPermissionsValue: 'Invalid permissions value',
  name: 'Name',
  permissions: 'Permissions',
  protectedRoleDescription:
    'This role is protected — its permissions are defined in code and cannot be edited here.',
  read: 'Read',
  role: 'User Role',
  roles: 'User Roles',
  rolesCollectionDescription:
    'Roles control what users can access. Assign them on the user document.',
  rolesFieldDescription: 'Roles controlling what this user can access.',
  update: 'Update',
} as const

export type RbacTranslation = {
  [Key in keyof typeof en]: string
}
