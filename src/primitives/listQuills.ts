import type { Quiver } from "@quillmark/quiver/node";
import type { Quill, Quillmark } from "@quillmark/wasm";
import { getErrorMessage } from "../internal/errorMessage.js";

export interface QuillSummary {
  name: string;
  description: string;
}

export async function listQuills(
  quiver: Quiver,
  engine: Quillmark,
): Promise<{ quills: QuillSummary[] }> {
  let names: string[];
  try {
    names = quiver.quillNames();
  } catch (err) {
    process.stderr.write(
      `[@quillmark/mcp] listQuills: quillNames() failed: ${getErrorMessage(err)}\n`,
    );
    return { quills: [] };
  }

  const quills = await Promise.all(
    names.map(async (name): Promise<QuillSummary | null> => {
      try {
        const quill = (await quiver.getQuill(name, { engine: engine as never })) as Quill;
        return { name, description: quill.metadata.description };
      } catch (err) {
        process.stderr.write(
          `[@quillmark/mcp] listQuills: skipping "${name}": ${getErrorMessage(err)}\n`,
        );
        return null;
      }
    }),
  );

  return { quills: quills.filter((q): q is QuillSummary => q !== null) };
}
