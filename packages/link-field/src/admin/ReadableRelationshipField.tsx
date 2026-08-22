'use client';

import { RelationshipField, useAuth } from '@payloadcms/ui';
import type { RelationshipFieldClientProps } from 'payload';

/** Prevents Payload's relationship input from probing collections the user cannot read. */
export const ReadableRelationshipField = (
  props: RelationshipFieldClientProps,
) => {
  const { permissions } = useAuth();
  const relationTo = props.field.relationTo;

  if (!permissions?.collections) return null;

  if (typeof relationTo === 'string') {
    if (!permissions.collections[relationTo]?.read) return null;
    return <RelationshipField {...props} />;
  }

  const readableRelations = relationTo.filter(
    (collection) => permissions.collections?.[collection]?.read,
  );
  if (readableRelations.length === 0) return null;

  return (
    <RelationshipField
      {...props}
      field={{ ...props.field, relationTo: readableRelations }}
    />
  );
};
