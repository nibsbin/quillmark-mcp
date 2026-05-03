import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerQuillmarkTools } from "../src/index.js";
import type { Deliverer } from "../src/index.js";
import { fakeEngine, fakeQuill, fakeQuiver } from "./helpers.js";

async function setup(deliver: Deliverer = async () => ({ status: "success" })) {
  const quiver = fakeQuiver({
    quills: new Map([
      ["memo@1.0.0", fakeQuill({ name: "memo", description: "memo desc" })],
    ]),
  });
  const server = new McpServer({ name: "test", version: "0.0.0" });
  registerQuillmarkTools(server, { quiver, engine: fakeEngine(), deliver });

  const client = new Client({ name: "test-client", version: "0.0.0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return { client, close: async () => server.close() };
}

describe("registerQuillmarkTools", () => {
  it("list_quills tool returns structured POJO and isError=false", async () => {
    const { client, close } = await setup();
    try {
      const res = (await client.callTool({ name: "list_quills" })) as {
        content: Array<{ type: string; text: string }>;
        structuredContent?: unknown;
        isError?: boolean;
      };
      expect(res.isError).toBeFalsy();
      expect(res.structuredContent).toEqual({
        quills: [{ name: "memo@1.0.0", description: "memo desc" }],
      });
      expect(JSON.parse(res.content[0].text)).toEqual(res.structuredContent);
    } finally {
      await close();
    }
  });

  it("get_specs returns schema + instructions", async () => {
    const { client, close } = await setup();
    try {
      const res = (await client.callTool({
        name: "get_specs",
        arguments: { ref: "memo@1.0.0" },
      })) as { structuredContent?: { schema?: unknown; instructions?: unknown }; isError?: boolean };
      expect(res.isError).toBeFalsy();
      expect(typeof res.structuredContent?.schema).toBe("string");
      expect(typeof res.structuredContent?.instructions).toBe("string");
    } finally {
      await close();
    }
  });

  it("get_specs sets isError=true when ref cannot resolve", async () => {
    const { client, close } = await setup();
    try {
      const res = (await client.callTool({
        name: "get_specs",
        arguments: { ref: "nope" },
      })) as { isError?: boolean; content: Array<{ text: string }> };
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toMatch(/quill_not_found/);
    } finally {
      await close();
    }
  });

  it("create_document maps error result to isError=true", async () => {
    const { client, close } = await setup();
    try {
      const res = (await client.callTool({
        name: "create_document",
        arguments: { content: "no frontmatter at all" },
      })) as { isError?: boolean; structuredContent?: { status?: string } };
      expect(res.isError).toBe(true);
      expect(res.structuredContent?.status).toBe("error");
    } finally {
      await close();
    }
  });

  it("create_document maps success result to isError=false", async () => {
    const valid = `---\nQUILL: memo@1.0.0\n---\n\nbody\n`;
    const { client, close } = await setup(async () => ({ status: "success", url: "ok" }));
    try {
      const res = (await client.callTool({
        name: "create_document",
        arguments: { content: valid },
      })) as { isError?: boolean; structuredContent?: { status?: string } };
      expect(res.isError).toBeFalsy();
      expect(res.structuredContent?.status).toBe("success");
    } finally {
      await close();
    }
  });

  it("create_document maps deliverer throws to isError=true", async () => {
    const valid = `---\nQUILL: memo@1.0.0\n---\n\nbody\n`;
    const { client, close } = await setup(async () => {
      throw new Error("boom");
    });
    try {
      const res = (await client.callTool({
        name: "create_document",
        arguments: { content: valid },
      })) as { isError?: boolean; content: Array<{ text: string }> };
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toMatch(/boom/);
    } finally {
      await close();
    }
  });
});
