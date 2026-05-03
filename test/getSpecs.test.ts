import { describe, it, expect } from "vitest";
import { getSpecs } from "../src/index.js";
import { fakeEngine, fakeQuill, fakeQuiver } from "./helpers.js";

describe("getSpecs", () => {
  it("returns TOON-encoded schema for a valid ref, including example when declared", async () => {
    const quiver = fakeQuiver({
      quills: new Map([
        [
          "memo",
          fakeQuill({
            name: "memo",
            example: "# Sample memo\n\nBody.",
          }),
        ],
      ]),
    });

    const result = await getSpecs(quiver, fakeEngine(), "memo");
    expect(typeof result.schema).toBe("string");
    expect(result.schema).toContain("Sample memo");
  });

  it("returns schema without example when not declared", async () => {
    const quiver = fakeQuiver({
      quills: new Map([["memo", fakeQuill({ name: "memo" })]]),
    });
    const result = await getSpecs(quiver, fakeEngine(), "memo");
    expect(typeof result.schema).toBe("string");
    expect(result.schema.length).toBeGreaterThan(0);
  });

  it("throws on empty ref", async () => {
    const quiver = fakeQuiver({ quills: new Map() });
    await expect(getSpecs(quiver, fakeEngine(), "")).rejects.toThrow();
    await expect(getSpecs(quiver, fakeEngine(), "   ")).rejects.toThrow();
  });

  it("throws when the ref cannot be resolved", async () => {
    const quiver = fakeQuiver({ quills: new Map() });
    await expect(getSpecs(quiver, fakeEngine(), "nope")).rejects.toThrow(
      /quill_not_found/,
    );
  });
});
