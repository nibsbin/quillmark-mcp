# @quillmark/mcp

MCP integration library for [Quillmark](https://github.com/nibsbin/quillmark). Surfaces Quillmark's parse → resolve → validate → render pipeline as three [Model Context Protocol](https://modelcontextprotocol.io) tools that any MCP client can call.

This library is transport-agnostic: it owns the tool contracts but leaves stdio/HTTP/SSE wiring and artifact delivery to the consumer. For a turnkey HTTP server using these tools, see [quillmark-mcp-turnkey](https://github.com/nibsbin/quillmark-mcp).

## Install

```sh
npm install @quillmark/mcp @modelcontextprotocol/sdk @quillmark/quiver @quillmark/wasm zod
```

Requires Node ≥ 24.

## Tools

- **`list_quills`** — discover available Quill formats. Returns `{ quills: [{ name, description }] }`.
- **`get_specs`** — get the schema for one Quill. Returns `{ schema }`, TOON-encoded for token-efficient LLM consumption. Includes a bundled `example` document when the Quill declares `example_file:`.
- **`create_document`** — render a document from YAML frontmatter + markdown. Returns `{ status, url?, errors? }` (the success shape is whatever the consumer's `Deliverer` returns).

## Usage

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Quiver } from "@quillmark/quiver/node";
import { Quillmark } from "@quillmark/wasm";
import { registerQuillmarkTools, type Deliverer } from "@quillmark/mcp";

const quiver = await Quiver.fromDir("./quills");
const engine = new Quillmark();

const deliver: Deliverer = async ({ render, canonicalRef }) => {
  const [artifact] = render();
  // upload artifact.bytes somewhere, return a URL...
  return { status: "success", url: `https://example.com/${canonicalRef}.pdf` };
};

const mcpServer = new McpServer({ name: "my-quillmark", version: "1.0.0" });
registerQuillmarkTools(mcpServer, { quiver, engine, deliver });

// connect mcpServer to your transport of choice
```

The library exports the three tool primitives directly (`listQuills`, `getSpecs`, `createDocument`) for consumers that want to call them without going through MCP.

## License

Apache-2.0
