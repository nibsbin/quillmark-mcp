import type { Quiver } from "@quillmark/quiver/node";
import type {
  Artifact,
  Diagnostic,
  Document,
  Form,
  FormCard,
  Quill,
  Quillmark,
  QuillMetadata,
  QuillSchema,
  RenderResult,
} from "@quillmark/wasm";

const EMPTY_FORM_CARD: FormCard = {
  schema: { fields: {} },
  values: {},
};

export interface FakeQuillOptions {
  name: string;
  version?: string;
  description?: string;
  example?: string;
  diagnostics?: Diagnostic[];
  metadataThrows?: boolean;
  artifacts?: Artifact[];
  renderWarnings?: Diagnostic[];
}

export function fakeQuill(opts: FakeQuillOptions): Quill {
  const version = opts.version ?? "1.0.0";
  const schema: QuillSchema = {
    name: opts.name,
    main: { fields: {}, title: opts.name },
    example: opts.example,
  };
  const baseMetadata: QuillMetadata = {
    schema,
    backend: "fake",
    version,
    author: "test",
    description: opts.description ?? "",
    supportedFormats: ["txt"],
  };

  const form: Form = {
    main: EMPTY_FORM_CARD,
    cards: [],
    diagnostics: opts.diagnostics ?? [],
  };

  const renderResult: RenderResult = {
    artifacts: opts.artifacts ?? [
      {
        format: "txt",
        bytes: new Uint8Array([1, 2, 3]),
        mimeType: "text/plain",
      },
    ],
    warnings: opts.renderWarnings ?? [],
    outputFormat: "txt",
    renderTimeMs: 0,
  };

  return {
    get metadata() {
      if (opts.metadataThrows) throw new Error(`broken quill: ${opts.name}`);
      return baseMetadata;
    },
    form: (_doc: Document) => form,
    render: (_doc: Document, _opts?: unknown) => renderResult,
    open: (_doc: Document) => {
      throw new Error("not implemented");
    },
    backendId: "fake",
    supportsCanvas: false,
  } as unknown as Quill;
}

export interface FakeQuiverOptions {
  quills: Map<string, Quill>;
}

export function fakeQuiver({ quills }: FakeQuiverOptions): Quiver {
  return {
    name: "test-quiver",
    quillNames: () => Array.from(quills.keys()),
    versionsOf: (_name: string) => ["1.0.0"],
    async loadTree() {
      throw new Error("not implemented");
    },
    async resolve(ref: string) {
      return ref;
    },
    async getQuill(ref: string) {
      const q = quills.get(ref);
      if (!q) {
        const err = new Error(`quill_not_found: ${ref}`);
        (err as { code?: string }).code = "quill_not_found";
        throw err;
      }
      return q;
    },
    async warm() {},
  } as unknown as Quiver;
}

export function fakeEngine(): Quillmark {
  return { quill: () => null } as unknown as Quillmark;
}
