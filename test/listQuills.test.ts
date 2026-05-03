import { describe, it, expect } from "vitest";
import { listQuills } from "../src/index.js";
import { fakeEngine, fakeQuill, fakeQuiver } from "./helpers.js";

describe("listQuills", () => {
  it("returns names + descriptions for every quill", async () => {
    const quiver = fakeQuiver({
      quills: new Map([
        ["alpha", fakeQuill({ name: "alpha", description: "A" })],
        ["beta", fakeQuill({ name: "beta", description: "B" })],
      ]),
    });

    const result = await listQuills(quiver, fakeEngine());
    expect(result).toEqual({
      quills: [
        { name: "alpha", description: "A" },
        { name: "beta", description: "B" },
      ],
    });
  });

  it("isolates per-quill metadata failures and skips them", async () => {
    const quiver = fakeQuiver({
      quills: new Map([
        ["alpha", fakeQuill({ name: "alpha", description: "A" })],
        ["broken", fakeQuill({ name: "broken", metadataThrows: true })],
      ]),
    });

    const result = await listQuills(quiver, fakeEngine());
    expect(result.quills).toEqual([{ name: "alpha", description: "A" }]);
  });

  it("returns empty list when catalog is empty", async () => {
    const quiver = fakeQuiver({ quills: new Map() });
    const result = await listQuills(quiver, fakeEngine());
    expect(result).toEqual({ quills: [] });
  });

  it("returns empty list when quillNames() throws", async () => {
    const quiver = {
      quillNames: () => {
        throw new Error("catalog broken");
      },
      async getQuill() {
        throw new Error("never");
      },
    } as never;

    const result = await listQuills(quiver, fakeEngine());
    expect(result).toEqual({ quills: [] });
  });
});
