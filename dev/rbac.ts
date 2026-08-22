import type { PredefinedRole, RbacPluginConfig } from '@sittari/payload-rbac';

export const devAdminRoleName = 'Developer';

export const devRbacRoles = [
  {
    name: 'Content Editor',
    description:
      'Protected content role used to preview the read-only matrix state.',
    permissions: [
      '*:read',
      'pages:create',
      'pages:update',
      'media:create',
      'media:update',
    ],
    protected: true,
  },
  {
    name: 'Viewer',
    description:
      'Editable database-owned role with read access to current and future entities.',
    permissions: ['*:read'],
  },
] satisfies PredefinedRole[];

export const devRbacPluginConfig = {
  adminRole: {
    name: devAdminRoleName,
    description: 'Protected full-access role for the local development user.',
  },
  roles: devRbacRoles,
} satisfies RbacPluginConfig;
