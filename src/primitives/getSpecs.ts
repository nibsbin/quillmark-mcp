import type { Quiver } from "@quillmark/quiver/node";
import type { Quill, Quillmark } from "@quillmark/wasm";
import { encode } from "@toon-format/toon";

export async function getSpecs(
  quiver: Quiver,
  engine: Quillmark,
  ref: string,
): Promise<{ schema: string; instructions: string }> {
  if (typeof ref !== "string" || ref.trim() === "") {
    throw new Error("Quill format reference must be a non-empty string.");
  }

  const quill = (await quiver.getQuill(ref, { engine: engine as never })) as Quill;
  const metadata = quill.metadata;
  const schema = encode(metadata.schema as unknown as Parameters<typeof encode>[0]);
  const instructions =
    typeof metadata.instructions === "string" ? metadata.instructions : "";

  return { schema, instructions };
}
