import type {
  Document,
  Artifact,
  RenderOptions,
  Diagnostic,
  QuillMetadata,
} from "@quillmark/wasm";

export type Render = (opts?: RenderOptions) => Artifact[];

export interface DelivererInput {
  doc: Document;
  render: Render;
  canonicalRef: string;
  metadata: QuillMetadata;
}

export type Deliverer = (input: DelivererInput) => Promise<DeliveryResult>;

export interface ErrorEntry {
  message: string;
  path?: string;
  severity?: string;
}

export type DeliveryResult =
  | ({ status: "success"; warnings?: Diagnostic[] } & {
      [key: string]: unknown;
    })
  | { status: "error"; errors: ErrorEntry[] };
