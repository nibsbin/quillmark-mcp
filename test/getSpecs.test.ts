import { describe, it, expect } from "vitest";
import { getSpecs } from "../src/index.js";
import { fakeEngine, fakeQuill, fakeQuiver } from "./helpers.js";

describe("getSpecs", () => {
  it("returns TOON-encoded schema and instructions for a valid ref", async () => {
    const quiver = fakeQuiver({
      quills: new Map([
        [
          "memo",
          fakeQuill({
            name: "memo",
            instructions: "Author memos in plain prose.",
          }),
        ],
      ]),
    });

    const result = await getSpecs(quiver, fakeEngine(), "memo");
    expect(typeof result.schema).toBe("string");
    expect(result.schema.length).toBeGreaterThan(0);
    expect(result.instructions).toBe("Author memos in plain prose.");
  });

  it("returns empty instructions when not declared", async () => {
    const quiver = fakeQuiver({
      quills: new Map([["memo", fakeQuill({ name: "memo" })]]),
    });
    const result = await getSpecs(quiver, fakeEngine(), "memo");
    expect(result.instructions).toBe("");
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
