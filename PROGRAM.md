# @quillmark/mcp — Design Doc

The Quillmark MCP integration library. Owns the parse → resolve → validate → MCP-envelope pipeline. Stops at delivery — the consumer decides whether bytes are rendered now and persisted, deferred to a web app, or anything else. Engine and quiver bootstrap stay with the consumer; the ecosystem APIs (`new Quillmark()`, `Quiver.fromDir`) are already terse and we don't wrap them.

## Purpose

A consumer building a Quillmark MCP server brings three things and hands them to `registerQuillmarkTools` along with their `McpServer`:

1. A `Quiver` (loaded with `Quiver.fromDir` / `fromPackage` / `fromBuilt`).
2. A `Quillmark` engine (`new Quillmark()`).
3. A `Deliverer` function describing what to do with a resolved-and-validated document.

Three Quillmark tools are then registered with proper MCP envelope handling. Everything else — transport, auth, static hosting, CLI, the deliverer's actual logic — stays out.

The package is Quillmark-specific by design. Anyone wanting a non-Quillmark MCP server uses `@modelcontextprotocol/sdk` directly. The library is not an aspirational generic toolkit.

## Audience

Two profiles, one API:

1. **Embedded.** A service builds its own `McpServer`, calls `registerQuillmarkTools`, and connects the SDK's transports under its own framework, auth, and lifecycle.
2. **Stdio CLI / Docker.** `quillmark-mcp-turnkey` is the canonical example: builds the `McpServer`, calls `registerQuillmarkTools`, connects an SDK `StdioServerTransport` (or HTTP transport).

The library doesn't distinguish between them.

## Stack

- Node.js ≥ 24, ESM, top-level `await`.
- TypeScript source compiled via `tsc`. `package.json` `prepare` script builds on install (so `npm link` against a fresh checkout works without manual build).
- Runtime deps (bundled): `@quillmark/wasm` (≥0.69.0, for typed `QuillMetadata`/`Form` and `parse::missing_quill_field`), `@quillmark/quiver` (≥0.5.1, for the `/node` subpath), `@toon-format/toon`. Anyone reaching for `@quillmark/mcp` wanted Quillmark.
- **Node.js WASM warning.** wasm ≥0.69.0 dropped the `node-esm` build target; the bundler entry now serves Node.js via the experimental WASM ESM proposal. Node 24 handles the static `.wasm` import automatically and emits one `ExperimentalWarning` to stderr per process start — no CLI flag required. Does not affect stdio JSON-RPC framing (stdout is untouched) but will appear in stdio server logs.
- Peer deps: `@modelcontextprotocol/sdk`, `zod`. Consumer supplies them; the library uses their copies (no cross-realm `instanceof` issues).

## Invariants

These and *Non-goals* are firm. Module layout, internal helper names, and exact wire formats for non-spec details are implementer discretion — update this doc if a cleaner pattern surfaces.

- **Library owns the parse → resolve → validate pipeline plus MCP wiring.** Consumer never calls `Document.fromMarkdown`, never `quill.form`, never `quill.render` (deliverer uses the curated `render` closure instead).
- **Library does not own engine or quiver bootstrap.** `init()`, `new Quillmark()`, `Quiver.fromX`, `quiver.warm()` are the consumer's. Two reasons: (a) the ecosystem deliberately keeps engine and quiver as separate concerns (one engine can serve many quivers), and (b) bundling them buys one line at the cost of an extra abstraction the consumer has to learn.
- **Library owns no transport or deployment plumbing.** No `start()`, no stdio bootstrap, no `requestHandler()`, no middleware, no default deliverer, no auth, no static hosting, no CLI.
- **Validation runs before delivery.** `createDocument` calls `quill.form(doc)` after resolution; fatal diagnostics short-circuit to `{ status: 'error', errors }`. The deliverer is invoked only on validation success and trusts the doc is schema-valid.
- **Deliverer signature is curated.** No `Quill`, no `RenderResult`. The deliverer receives `{ doc, render, canonicalRef, metadata }` — render is a pre-bound closure returning artifacts, canonicalRef is the resolved version (e.g. `"memo@1.2.3"`), metadata is the quill identity/schema snapshot.
- **Render warnings are library-managed.** The render closure captures `RenderResult.warnings` internally; the library folds them into the success envelope's `warnings` field. The deliverer doesn't see them and can't drop them.
- **Stay off stdout.** Internal logging goes to stderr (stdout is reserved for stdio JSON-RPC framing — a single stray byte disconnects the client).
- **Tool exceptions become tool results.** Inside `registerQuillmarkTools`'s callbacks, every throw is caught and converted to an `{ isError: true }` envelope. The SDK's transport-level error path is never reached for tool failures.
- **Tool registration is one shot.** Calling `registerQuillmarkTools` twice on the same `McpServer` lets the SDK's duplicate-name error fire; we don't add a layer.
- **Doc is not mutated between `form()` and deliver.** `quill.form(doc)` is a snapshot (per wasm contract); the library never edits `doc` after validation, so the form snapshot is current at delivery time. Deliverers may mutate `doc` for their own purposes, but that is post-validation.
- **wasm types are trusted, not runtime-validated.** `quill.metadata: QuillMetadata` and `quill.form(doc): Form` are structurally typed in wasm ≥0.69.0; the library does not add a second layer of runtime schema validation. A quill that produces unexpected shapes at runtime throws — that indicates a malformed quill, not a user input failure.
- **Render closure shape is `(opts?) => Artifact[]`.** `RenderResult.warnings` is captured by the closure and folded into the success envelope. `RenderResult.outputFormat` is recoverable from `artifacts[0].format`; `RenderResult.renderTimeMs` is observability and intentionally not exposed.
- **Trust the wasm parser for missing-QUILL detection.** `Document.fromMarkdown` (wasm ≥0.69.0) emits a `parse::missing_quill_field` diagnostic and throws when `QUILL:` is absent. The library does not add a defensive post-parse `quillRef` empty-string check.

## Public API

Four runtime exports. Plus type exports. No sub-namespaces.

```ts
import {
  listQuills,
  getSpecs,
  createDocument,
  registerQuillmarkTools,
  type Deliverer,
  type DeliveryResult,
  // wasm types re-exported so consumers don't need a direct @quillmark/wasm dep:
  type QuillMetadata,    // re-exported from wasm ≥0.69.0; no local mirror
  type QuillSchema,      // typeof metadata.schema — useful for typed schema introspection
  type Document,
  type Artifact,
  type RenderOptions,
  type Diagnostic,
  type OutputFormat,
} from '@quillmark/mcp';
```

## Setup (consumer-side)

Canonical five-line bootstrap. The library imports nothing into this flow — the consumer wires the ecosystem packages directly:

```ts
import { Quillmark, init } from '@quillmark/wasm';
import { Quiver } from '@quillmark/quiver/node';     // see "Quiver entry split" below
import { registerQuillmarkTools, type Deliverer } from '@quillmark/mcp';

init();                                              // optional panic-hook setup
const engine = new Quillmark();
const quiver = await Quiver.fromDir('./quiver');     // or fromPackage / fromBuilt
await quiver.warm();                                 // recommended; prefetches trees

const deliver: Deliverer = async ({ doc, render }) => { /* ... */ };

registerQuillmarkTools(mcpServer, { quiver, engine, deliver });
```

`init()` is idempotent panic-hook setup; calling it more than once is harmless. `quiver.warm()` is engine-independent and prefetches every quill tree so first-request latency stays low.

**Quiver entry split.** `@quillmark/quiver` ships two entries: the main entry exposes only the browser-safe `Quiver.fromBuilt(url)`; the `/node` subpath additionally installs `Quiver.fromDir`, `Quiver.fromPackage`, and `Quiver.build`. Node consumers import from `@quillmark/quiver/node`. The library itself never imports `Quiver` (it only consumes the instance the consumer hands in), so this is purely a consumer-side concern documented here so the bootstrap doesn't drift.

### `listQuills(quiver, engine): Promise<{ quills: Array<{ name: string; description: string }> }>`

Iterates `quiver.quillNames()`, resolves each via `quiver.getQuill(name, { engine })` to access metadata, returns `{ quills: [...] }` with one entry per quill. Per-quill metadata failures isolated (logged to stderr, skipped). Returns `{ quills: [] }` for empty/unreadable catalogs. The wrapping object exists so every primitive's return shape is a JSON object (POJO), letting the MCP callback unconditionally set `structuredContent: result` without an array guard.

### `getSpecs(quiver, engine, ref): Promise<{ schema: string }>`

Resolves `ref` (`name`, `name@x`, `name@x.y`, `name@x.y.z`) via `quiver.getQuill(ref, { engine })`. Returns:

- `schema`: TOON-encoded `quill.metadata.schema` (uses `@toon-format/toon`). When the quill declares `example_file:` in `Quill.yaml`, the resulting `schema.example` field carries the example document and is included in the encoded output.

Throws on empty `ref` or resolution failure (the MCP-layer wrapper converts the throw into an `isError: true` envelope).

### `createDocument(quiver, engine, deliver, content): Promise<DeliveryResult>`

The full Quillmark pipeline:

```
Document.fromMarkdown(content)               // throws → { status: 'error', errors }
  → quiver.getQuill(doc.quillRef, { engine })  // throws → { status: 'error', errors }
  → quill.form(doc)                          // fatal diagnostics → { status: 'error', errors }
  → deliver({ doc, render, canonicalRef, metadata })
```

Render warnings captured by the bound `render` closure and folded into `result.warnings` on success.

```ts
type Deliverer = (input: {
  doc: Document;
  render: (opts?: RenderOptions) => Artifact[];
  canonicalRef: string;               // resolved version, e.g. "memo@1.2.3"
  metadata: QuillMetadata;
}) => Promise<DeliveryResult>;

type DeliveryResult =
  | { status: 'success'; warnings?: Diagnostic[]; [key: string]: unknown }
  | { status: 'error'; errors: ErrorEntry[] };

interface ErrorEntry {
  message: string;
  path?: string;       // schema-violation field path (form() origin)
  severity?: string;   // "error" | "warning" — promoted only for fatal entries
}
```

`ErrorEntry` is a library-curated shape, not the upstream wasm `Diagnostic`. The library normalizes parse exceptions, `QuiverError`s, and fatal `form()` diagnostics into this single shape so deliverers and MCP clients see one error contract. `Diagnostic` is re-exported because it appears on the *success* envelope's `warnings` field (parse-time + render-time warnings), not because it shapes errors.

Deliverer throws propagate from `createDocument`. The MCP-layer try/catch in `registerQuillmarkTools` is the only safety net, and only on the MCP path.

#### Use cases the contract serves

Two canonical patterns motivate the input shape; neither lives in this library. **Eager render** (turnkey's case) calls `render(...)` to materialize artifacts immediately and persists bytes — needs `doc` + `render`. **Deferred persistence** (web-app case) skips `render` entirely, stores `doc.toMarkdown()` plus `canonicalRef`, and lets a downstream UI render on demand — this is why `canonicalRef` and `metadata` are on the input rather than tucked behind `render`. Reference implementations live in `quillmark-mcp-turnkey` and consumer code, not here.

### `registerQuillmarkTools(mcpServer, { quiver, engine, deliver }): void`

Registers three tools on the consumer's `McpServer` via `mcpServer.registerTool(...)`. Tool callbacks own envelope wrapping and exception → `isError` mapping.

| Tool name         | Input schema              | Calls                                              |
|-------------------|---------------------------|----------------------------------------------------|
| `list_quills`     | `z.object({})`            | `listQuills(quiver, engine)`                       |
| `get_specs`       | `z.object({ ref })`       | `getSpecs(quiver, engine, ref)`                    |
| `create_document` | `z.object({ content })`   | `createDocument(quiver, engine, deliver, content)` |

For `create_document`, the callback additionally maps `result.status === 'error'` to `isError: true` on the envelope (so clients distinguishing errored tool calls render correctly), without treating it as a thrown error.

## Tool callback contract

Every callback follows this shape:

```ts
async (args) => {
  try {
    const result = await primitive(...);
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
      structuredContent: result,
      isError: shouldFlagAsError(result),
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: getErrorMessage(err) }],
      isError: true,
    };
  }
};
```

- Every primitive returns a POJO by contract (`{ quills: [...] }`, `{ schema }`, `DeliveryResult`), so `structuredContent` takes `result` unconditionally — no runtime POJO check needed.
- `getErrorMessage`: `err?.message ?? String(err)`. Internal helper, not exported.
- `shouldFlagAsError`: `false` for `list_quills` / `get_specs`; `result.status === 'error'` for `create_document`.

Tool descriptions and parameter docs are baked into each registration call. The library owns tool-level guidance ("how to use the tool"); per-quill authoring guidance lives in `quill.metadata` and surfaces through `get_specs`.


## Non-goals

Explicit. None of these belong in the library, even under a sub-namespace:

- **Stdio start/stop.** Two SDK lines; consumer owns it.
- **HTTP request handler / per-request rebuild.** SDK ergonomics, not our problem.
- **Middleware** (`compose`, `routeMatch`, `bearerAuth`, `staticRoute`, `notFoundJson`). Turnkey or consumer code.
- **Default deliverer / `RenderAndHostStrategy`.** Deployment opinions live in turnkey.
- **Strategy base class** (`DeliveryStrategy`). `Deliverer` is a function type.
- **Composition helpers** (`withRetry`, `withTimeout`, `pipe`). Generic JS; five lines each.
- **`renderAndPersist` or other Quillmark-flavored composition helpers.** Borderline; defer until two callers want it.
- **Generic `addTool` API.** Consumers use `mcpServer.registerTool` directly for their own tools.
- **`createMcpServer` or `createQuillmarkServer` factory.** Aspirational generic toolkit / transport ownership; cut.
- **Engine construction, `init()` ordering, quiver source dispatch, warming.** Consumer's job. The wrapper we briefly considered (`loadQuiver`) saved one line, hid one decision (`fromX` selection), and added an abstraction the ecosystem deliberately doesn't have. Not worth it.
- **`prepare` lifecycle.** Consumer calls `quiver.warm()` if it wants eager init.
- **Exported logger or `getErrorMessage`.** Internal use only.
- **CLI scaffolding, Docker, install snippets, per-client config.** That's `quillmark-mcp-turnkey`.
- **MCP resources and prompts.** v1 is tools-only.
- **Non-text tool outputs** (images, audio, resource references). Every return renders into `content[0].text`.
- **Sessioned HTTP, OAuth 2.1 discovery, OAuth-probe 404.** Consumer / turnkey concerns.
- **Tool toggles / subset selection.** Consumer registers a subset by hand from the primitives.
- **Validate-only tool / primitive.** Validation is implicit in `createDocument`; LLM iteration loop is `try → fix → try` against the error envelope.
- **`Quill` or `RenderResult` in the deliverer signature.** Curated input only.
- **`format` parameter on the MCP tool.** Deliverer's choice; not exposed to the LLM.
- **Sub-namespaces.** Top level fits.

## Module layout

Sketch — consolidate or split as natural.

```
@quillmark/mcp/
  src/
    index.ts                        # runtime + type re-exports
    primitives/
      listQuills.ts
      getSpecs.ts
      createDocument.ts             # parse → resolve → validate → deliver
    registerQuillmarkTools.ts       # SDK registerTool calls + envelope wrapping
    internal/
      errorMessage.ts               # getErrorMessage extractor
      diagnostics.ts                # fatal-vs-warning classification for form() output
      types.ts                      # public types (Deliverer, DeliveryResult); QuillMetadata/QuillSchema re-exported from wasm
  test/
    listQuills.test.ts
    getSpecs.test.ts
    createDocument.test.ts
    registerQuillmarkTools.test.ts
  package.json
  tsconfig.json
```

## Testing

Vitest. Coverage targets:

- **`listQuills`**: fixture quiver with two quills → `{ quills: [...] }` with both entries. Quill with broken metadata → skipped, others returned, stderr noted. Empty quiver → `{ quills: [] }`.

- **`getSpecs`**: valid ref → TOON-encoded schema string; selector ref (`name`, `name@x`) → resolves to highest match; missing/empty ref → throws.

- **`createDocument`**: malformed frontmatter → error result; unknown quill → error result; schema violation (missing required field) → error result with diagnostic; valid content + eager deliverer → deliverer's result with render warnings folded into `warnings`; valid content + deferred deliverer (no render call) → deliverer's result, no warnings; deliverer throws → propagates from `createDocument`.

- **`registerQuillmarkTools`**: integration test using the SDK's in-memory transport pair. Invoke each tool through JSON-RPC; assert envelope:
  - `content[0].text` is the JSON-stringified primitive result.
  - `structuredContent` equals the primitive's return value (always a POJO by contract).
  - `isError: true` for: thrown primitive errors (all three tools), `create_document` returning `{ status: 'error' }`. `false` otherwise.

No tests for stdio or HTTP transports — the library doesn't own them.

## Acceptance

The library is done when:

1. Four runtime exports + the documented type exports compile and resolve from a fresh `npm install`.
2. The vitest suite passes against a fixture quiver covering: success path, parse error, resolve error, schema violation, deliverer throw, deferred deliverer (no render call), eager deliverer with captured warnings.
3. No exported symbol matches a *Non-goal* above.
