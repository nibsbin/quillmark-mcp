import type { Quiver } from "@quillmark/quiver/node";
import type { Quill, Quillmark } from "@quillmark/wasm";
import { encode } from "@toon-format/toon";

export async function getSpecs(
  quiver: Quiver,
  engine: Quillmark,
  ref: string,
): Promise<{ schema: string }> {
  if (ref.trim() === "") {
    throw new Error("Quill format reference must be a non-empty string.");
  }

  const quill = (await quiver.getQuill(ref, { engine: engine as never })) as Quill;
  const schema = encode(quill.metadata.schema);

  return { schema };
}
