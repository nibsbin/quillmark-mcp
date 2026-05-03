import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Quiver } from "@quillmark/quiver/node";
import type { Quillmark } from "@quillmark/wasm";
import { z } from "zod";
import { listQuills } from "./primitives/listQuills.js";
import { getSpecs } from "./primitives/getSpecs.js";
import { createDocument } from "./primitives/createDocument.js";
import { getErrorMessage } from "./internal/errorMessage.js";
import type { Deliverer } from "./internal/types.js";

const LIST_QUILLS_DESCRIPTION =
  "List available Quill formats with names and descriptions. A Quill format is a schematized document template for Quillmark. Call this when you need to discover which format to use. Returns { quills: [{ name, description }] }.";
const GET_SPECS_DESCRIPTION =
  "Get the schema and authoring instructions for a specific Quill format. Returns { schema, instructions } where schema is TOON-encoded (token-efficient for LLM consumption). Use the schema to structure content and follow the instructions for authoring guidance.";
const CREATE_DOCUMENT_DESCRIPTION =
  "Create a document from Quillmark content. Input must be a string containing YAML frontmatter with a QUILL: field (selecting the Quill format) and a markdown body. On schema violation or parse failure, returns { status: 'error', errors: [...] } — fix and retry.";

export interface RegisterQuillmarkToolsOptions {
  quiver: Quiver;
  engine: Quillmark;
  deliver: Deliverer;
}

export function registerQuillmarkTools(
  mcpServer: McpServer,
  { quiver, engine, deliver }: RegisterQuillmarkToolsOptions,
): void {
  mcpServer.registerTool(
    "list_quills",
    {
      description: LIST_QUILLS_DESCRIPTION,
    },
    async () => {
      try {
        const result = await listQuills(quiver, engine);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result) }],
          structuredContent: result,
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: getErrorMessage(err) }],
          isError: true,
        };
      }
    },
  );

  mcpServer.registerTool(
    "get_specs",
    {
      description: GET_SPECS_DESCRIPTION,
      inputSchema: { ref: z.string() },
    },
    async ({ ref }) => {
      try {
        const result = await getSpecs(quiver, engine, ref);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result) }],
          structuredContent: result,
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: getErrorMessage(err) }],
          isError: true,
        };
      }
    },
  );

  mcpServer.registerTool(
    "create_document",
    {
      description: CREATE_DOCUMENT_DESCRIPTION,
      inputSchema: { content: z.string() },
    },
    async ({ content }) => {
      try {
        const result = await createDocument(quiver, engine, deliver, content);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result) }],
          structuredContent: result,
          isError: result.status === "error",
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: getErrorMessage(err) }],
          isError: true,
        };
      }
    },
  );
}
