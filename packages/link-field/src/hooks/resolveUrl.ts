import type { FieldHook, RelationshipField } from 'payload';

import type { ResolveDocumentUrl, ResolveUrlHookArgs } from '../types.js';
import { getReferenceIdentity } from '../utils/getReferenceIdentity.js';
import { isValidUrl } from '../utils/validateUrl.js';

const RESOLVING_LINK_URL_CONTEXT_KEY = 'linkFieldResolvingUrl';

const getLocale = (args: ResolveUrlHookArgs): null | string | undefined =>
  (args.req as unknown as { locale?: null | string }).locale;

const getFallbackLocale = (
  args: ResolveUrlHookArgs,
): false | null | string | string[] | undefined =>
  (args.req as unknown as { fallbackLocale?: false | null | string | string[] })
    .fallbackLocale;

const getRelationshipField = (
  siblingFields: ResolveUrlHookArgs['siblingFields'],
): RelationshipField | undefined =>
  siblingFields.find(
    (field): field is RelationshipField =>
      'name' in field &&
      field.name === 'reference' &&
      field.type === 'relationship',
  );

export const createResolveUrlHook = (
  resolveDocumentUrl: ResolveDocumentUrl,
): FieldHook<any, null | string, ResolveUrlHookArgs['siblingData']> => {
  return async (args) => {
    if (args.context?.[RESOLVING_LINK_URL_CONTEXT_KEY]) {
      return null;
    }

    const siblingData = args.siblingData;

    if (!siblingData?.type) {
      return null;
    }

    if (siblingData.type === 'custom') {
      return isValidUrl(siblingData.customUrl)
        ? (siblingData.customUrl ?? null)
        : null;
    }

    if (siblingData.type !== 'reference') {
      return null;
    }

    const relationshipField = getRelationshipField(args.siblingFields);
    const identity = getReferenceIdentity({
      reference: siblingData.reference,
      relationTo: relationshipField?.relationTo,
    });

    if (!identity) {
      return null;
    }

    try {
      const document =
        identity.document ??
        ((await args.req.payload.findByID({
          collection: identity.collectionSlug as never,
          context: {
            ...(args.context ?? {}),
            [RESOLVING_LINK_URL_CONTEXT_KEY]: true,
          },
          depth: 0,
          disableErrors: true,
          draft: args.draft,
          fallbackLocale: getFallbackLocale(args),
          id: identity.documentId,
          locale: getLocale(args),
          overrideAccess: args.overrideAccess,
          req: args.req,
        } as never)) as null | Record<string, unknown>);

      if (!document) {
        return null;
      }

      return await resolveDocumentUrl({
        collectionSlug: identity.collectionSlug,
        document,
        documentId: identity.documentId,
        fallbackLocale: getFallbackLocale(args),
        fieldPath: args.path.join('.'),
        locale: getLocale(args),
        originalDoc: args.originalDoc ?? args.data,
        payload: args.req.payload,
        req: args.req,
        siblingData,
      });
    } catch (error) {
      args.req.payload.logger?.error?.({
        err: error,
        msg: 'Failed to resolve link field URL',
      });

      return null;
    }
  };
};
