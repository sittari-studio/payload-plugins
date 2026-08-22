export const getReferenceDocumentUrl = ({
  apiRoute,
  collectionSlug,
  documentId,
  locale,
}: {
  apiRoute: string;
  collectionSlug: string;
  documentId: number | string;
  locale?: string;
}): string => {
  const normalizedApiRoute = apiRoute.startsWith('/')
    ? apiRoute
    : `/${apiRoute}`;
  const searchParams = new URLSearchParams({
    depth: '0',
  });

  if (locale) {
    searchParams.set('locale', locale);
  }

  return `${normalizedApiRoute}/${encodeURIComponent(collectionSlug)}/${encodeURIComponent(String(documentId))}?${searchParams}`;
};
