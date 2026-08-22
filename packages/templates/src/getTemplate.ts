import type { Payload } from 'payload';

export type GetPayload = () => Payload | Promise<Payload>;

export type TemplateName<TDocument> = {
  [TKey in Extract<keyof TDocument, string>]: TKey extends `data_${infer TName}`
    ? TName
    : never;
}[Extract<keyof TDocument, string>];

export type TemplateDocumentFor<
  TDocument extends { id: number | string },
  TName extends TemplateName<TDocument>,
> = Pick<TDocument, 'id' | Extract<keyof TDocument, `data_${TName}`>>;

/**
 * Creates a typed template lookup backed by the provided Payload getter.
 *
 * The generated template document type is used to derive valid template names
 * and the selected `data_<name>` group returned for each lookup.
 */
export const createTemplateGetter =
  <TDocument extends { id: number | string }>(getPayload: GetPayload) =>
  async <TName extends TemplateName<TDocument>>(
    templateName: TName,
  ): Promise<TemplateDocumentFor<TDocument, TName> | null> => {
    const payload = await getPayload();
    const groupField = `data_${templateName}`;
    const result = await payload.find({
      collection: 'templates' as never,
      depth: 0,
      limit: 1,
      pagination: false,
      select: {
        [groupField]: true,
      },
      where: {
        templateType: {
          equals: templateName,
        },
      },
    });

    const doc = result.docs[0] as
      | TemplateDocumentFor<TDocument, TName>
      | undefined;
    if (!doc) {
      return null;
    }
    return doc;
  };
