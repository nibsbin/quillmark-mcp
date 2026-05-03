import { describe, it, expect } from "vitest";
import type { Diagnostic } from "@quillmark/wasm";
import { createDocument } from "../src/index.js";
import type { Deliverer, DeliveryResult } from "../src/index.js";
import { fakeEngine, fakeQuill, fakeQuiver } from "./helpers.js";

const validContent = `---
QUILL: memo@1.0.0
---

Body.
`;

describe("createDocument", () => {
  it("returns error result on parse failure (missing QUILL)", async () => {
    const quiver = fakeQuiver({ quills: new Map() });
    const deliver: Deliverer = async () => ({ status: "success" });

    const result = await createDocument(quiver, fakeEngine(), deliver, "no frontmatter");
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it("returns error result when quill cannot be resolved", async () => {
    const quiver = fakeQuiver({ quills: new Map() });
    const deliver: Deliverer = async () => ({ status: "success" });

    const result = await createDocument(quiver, fakeEngine(), deliver, validContent);
    expect(result.status).toBe("error");
  });

  it("returns error result on schema-violation diagnostics", async () => {
    const fatal: Diagnostic = {
      severity: "error",
      message: "missing required field 'subject'",
      sourceChain: [],
      location: { file: "subject", line: 0, column: 0 },
    };
    const quiver = fakeQuiver({
      quills: new Map([
        ["memo@1.0.0", fakeQuill({ name: "memo", diagnostics: [fatal] })],
      ]),
    });
    const deliver: Deliverer = async () => ({ status: "success" });

    const result = await createDocument(quiver, fakeEngine(), deliver, validContent);
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.errors[0].message).toMatch(/missing required field/);
      expect(result.errors[0].path).toBe("subject");
    }
  });

  it("filters non-fatal diagnostics (warnings) before invoking deliverer", async () => {
    const warning: Diagnostic = {
      severity: "warning",
      message: "soft note",
      sourceChain: [],
    };
    const quiver = fakeQuiver({
      quills: new Map([
        ["memo@1.0.0", fakeQuill({ name: "memo", diagnostics: [warning] })],
      ]),
    });
    const deliver: Deliverer = async () => ({ status: "success", url: "x" });

    const result = await createDocument(quiver, fakeEngine(), deliver, validContent);
    expect(result.status).toBe("success");
  });

  it("eager deliverer: render warnings get folded into success envelope", async () => {
    const warning: Diagnostic = {
      severity: "warning",
      message: "render note",
      sourceChain: [],
    };
    const quiver = fakeQuiver({
      quills: new Map([
        ["memo@1.0.0", fakeQuill({ name: "memo", renderWarnings: [warning] })],
      ]),
    });
    const deliver: Deliverer = async ({ render }) => {
      const artifacts = render();
      return { status: "success", artifactCount: artifacts.length };
    };

    const result = (await createDocument(
      quiver,
      fakeEngine(),
      deliver,
      validContent,
    )) as Extract<DeliveryResult, { status: "success" }>;
    expect(result.status).toBe("success");
    expect(result.warnings).toEqual([warning]);
    expect(result.artifactCount).toBe(1);
  });

  it("deferred deliverer (no render): no warnings on result", async () => {
    const quiver = fakeQuiver({
      quills: new Map([["memo@1.0.0", fakeQuill({ name: "memo" })]]),
    });
    const deliver: Deliverer = async ({ canonicalRef, doc }) => ({
      status: "success",
      ref: canonicalRef,
      markdown: doc.toMarkdown(),
    });

    const result = (await createDocument(
      quiver,
      fakeEngine(),
      deliver,
      validContent,
    )) as Extract<DeliveryResult, { status: "success" }>;
    expect(result.status).toBe("success");
    expect(result.warnings).toBeUndefined();
    expect(result.ref).toBe("memo@1.0.0");
  });

  it("propagates deliverer throws to the caller", async () => {
    const quiver = fakeQuiver({
      quills: new Map([["memo@1.0.0", fakeQuill({ name: "memo" })]]),
    });
    const deliver: Deliverer = async () => {
      throw new Error("deliverer-broke");
    };

    await expect(
      createDocument(quiver, fakeEngine(), deliver, validContent),
    ).rejects.toThrow("deliverer-broke");
  });

  it("passes canonicalRef and metadata to the deliverer", async () => {
    const quiver = fakeQuiver({
      quills: new Map([["memo@1.0.0", fakeQuill({ name: "memo" })]]),
    });
    let captured: { canonicalRef?: string; metadataName?: string } = {};
    const deliver: Deliverer = async ({ canonicalRef, metadata }) => {
      captured.canonicalRef = canonicalRef;
      captured.metadataName = metadata.schema.name;
      return { status: "success" };
    };

    await createDocument(quiver, fakeEngine(), deliver, validContent);
    expect(captured.canonicalRef).toBe("memo@1.0.0");
    expect(captured.metadataName).toBe("memo");
  });
});
