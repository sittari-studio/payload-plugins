import type { RbacTranslation } from './en.js';

export const ru = {
  all: 'Все',
  allActions: 'все действия',
  collectionOrGlobal: 'Коллекция или глобальная сущность',
  collections: 'Коллекции',
  create: 'Создание',
  delete: 'Удаление',
  description: 'Описание',
  everything: 'Всё',
  fullAccess: 'Полный доступ',
  fullAccessDescription:
    'Полный доступ — все действия со всеми коллекциями и глобальными сущностями, включая добавленные в будущем',
  globals: 'Глобальные сущности',
  invalidPermissionsValue: 'Некорректное значение разрешений',
  name: 'Название',
  permissions: 'Разрешения',
  protectedRoleDescription:
    'Эта роль защищена — её разрешения определены в коде, поэтому здесь их нельзя редактировать.',
  read: 'Чтение',
  role: 'Роль пользователя',
  roles: 'Роли пользователей',
  rolesCollectionDescription:
    'Роли определяют, к чему имеют доступ пользователи. Назначайте их в документе пользователя.',
  rolesFieldDescription: 'Роли, определяющие доступ этого пользователя.',
  update: 'Обновление',
} satisfies RbacTranslation;
