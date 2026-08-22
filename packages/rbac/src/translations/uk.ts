import type { RbacTranslation } from './en.js';

export const uk = {
  all: 'Усі',
  allActions: 'усі дії',
  collectionOrGlobal: 'Колекція або глобальна сутність',
  collections: 'Колекції',
  create: 'Створення',
  delete: 'Видалення',
  description: 'Опис',
  everything: 'Усе',
  fullAccess: 'Повний доступ',
  fullAccessDescription:
    'Повний доступ — усі дії з усіма колекціями та глобальними сутностями, включно з доданими в майбутньому',
  globals: 'Глобальні сутності',
  invalidPermissionsValue: 'Некоректне значення дозволів',
  name: 'Назва',
  permissions: 'Дозволи',
  protectedRoleDescription:
    'Ця роль захищена — її дозволи визначено в коді, тому тут їх не можна редагувати.',
  read: 'Читання',
  role: 'Роль користувача',
  roles: 'Ролі користувачів',
  rolesCollectionDescription:
    'Ролі визначають, до чого мають доступ користувачі. Призначайте їх у документі користувача.',
  rolesFieldDescription: 'Ролі, що визначають доступ цього користувача.',
  update: 'Оновлення',
} satisfies RbacTranslation;
