import type { Quiver } from "@quillmark/quiver/node";
import {
  Document,
  type Artifact,
  type Diagnostic,
  type Quill,
  type Quillmark,
  type RenderOptions,
  type RenderResult,
} from "@quillmark/wasm";
import { getErrorMessage } from "../internal/errorMessage.js";
import {
  diagnosticToErrorEntry,
  isFatal,
} from "../internal/diagnostics.js";
import type { Deliverer, DeliveryResult, ErrorEntry } from "../internal/types.js";

function errorResult(errors: ErrorEntry[]): DeliveryResult {
  return { status: "error", errors };
}

export async function createDocument(
  quiver: Quiver,
  engine: Quillmark,
  deliver: Deliverer,
  content: string,
): Promise<DeliveryResult> {
  let doc: Document;
  try {
    doc = Document.fromMarkdown(content);
  } catch (err) {
    return errorResult([{ message: getErrorMessage(err) }]);
  }

  let quill: Quill;
  try {
    quill = (await quiver.getQuill(doc.quillRef, {
      engine: engine as never,
    })) as Quill;
  } catch (err) {
    return errorResult([{ message: getErrorMessage(err) }]);
  }

  let form;
  try {
    form = quill.form(doc);
  } catch (err) {
    return errorResult([{ message: getErrorMessage(err) }]);
  }

  const fatals = form.diagnostics.filter(isFatal);
  if (fatals.length > 0) {
    return errorResult(fatals.map(diagnosticToErrorEntry));
  }

  const capturedWarnings: Diagnostic[] = [];
  const render = (opts?: RenderOptions): Artifact[] => {
    const result: RenderResult = quill.render(doc, opts ?? null);
    if (Array.isArray(result.warnings)) {
      capturedWarnings.push(...result.warnings);
    }
    return result.artifacts;
  };

  const canonicalRef = `${quill.metadata.schema.name}@${quill.metadata.version}`;

  const result = await deliver({
    doc,
    render,
    canonicalRef,
    metadata: quill.metadata,
  });

  if (result.status === "success" && capturedWarnings.length > 0) {
    const existing = Array.isArray(result.warnings) ? result.warnings : [];
    return { ...result, warnings: [...existing, ...capturedWarnings] };
  }

  return result;
}
