import type { Quiver } from "@quillmark/quiver/node";
import type { Quillmark } from "@quillmark/wasm";
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
        const quill = await quiver.getQuill(name, { engine: engine as never });
        const metadata = (quill as { metadata?: unknown }).metadata;
        const description =
          metadata &&
          typeof metadata === "object" &&
          "description" in metadata &&
          typeof (metadata as { description: unknown }).description === "string"
            ? ((metadata as { description: string }).description)
            : "";
        return { name, description };
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
