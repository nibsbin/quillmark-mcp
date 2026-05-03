import type { Diagnostic } from "@quillmark/wasm";
import type { ErrorEntry } from "./types.js";

export function isFatal(d: Diagnostic): boolean {
  return d.severity === "error";
}

export function diagnosticToErrorEntry(d: Diagnostic): ErrorEntry {
  const entry: ErrorEntry = { message: d.message };
  if (d.location?.file) entry.path = d.location.file;
  if (d.severity) entry.severity = d.severity;
  return entry;
}
