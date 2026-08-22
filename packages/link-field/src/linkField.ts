import type { GroupField } from 'payload';

import {
  LINK_FIELD_ADMIN_COMPONENT,
  LINK_FIELD_MARKER,
  type LinkFieldConfig,
} from './types.js';
import { createLinkFields } from './linkFields.js';

export const linkField = ({
  appearance = 'drawer',
  defaultType = 'custom',
  label,
  name,
  relationTo,
  required = false,
  showLabel = true,
  showNewTab = true,
  localizeLabel = true,
}: LinkFieldConfig): GroupField => {
  return {
    name,
    type: 'group',
    admin: {
      components: {
        Field: LINK_FIELD_ADMIN_COMPONENT,
      },
      custom: {
        linkField: {
          appearance,
          marker: LINK_FIELD_MARKER,
          showLabel,
          showNewTab,
        },
      },
    },
    fields: createLinkFields({
      defaultType,
      relationTo,
      required,
      showLabel,
      showNewTab,
      localizeLabel,
    }),
    label,
  };
};
