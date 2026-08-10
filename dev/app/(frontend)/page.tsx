import type { SerializedEditorState } from "@payloadcms/richtext-lexical/lexical";

import { RichText } from "./components/RichText.js";
import { getPayload } from "payload";
import configPromise from "@payload-config";

const content = {
  root: {
    children: [
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: "normal",
            style: "",
            text: "Payload link-field React converter",
            type: "text",
            version: 1,
          },
        ],
        direction: null,
        fields: {
          customUrl: "/docs",
          type: "custom",
          url: "/docs",
        },
        format: "",
        id: "react-converter-link",
        indent: 0,
        type: "autolink",
        version: 1,
      },
    ],
    direction: null,
    format: "",
    indent: 0,
    type: "root",
    version: 1,
  },
} as unknown as SerializedEditorState;

const Page = async () => {
  const payload = await getPayload({ config: configPromise });
  const page = await payload.find({
    collection: "pages",
    where: {
      id: {
        equals: 1,
      },
    },
  });
  if (page.docs.length === 0 || !page.docs[0]!.standardContent?.content) {
    return (
      <main>
        <h1>Frontend RichText fixture</h1>
        <RichText data={content} />
      </main>
    );
  }
  return (
    <main>
      <RichText data={page.docs[0]!.standardContent?.content} />
    </main>
  );
};

export default Page;
