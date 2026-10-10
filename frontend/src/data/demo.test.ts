import { describe, expect, it } from "vitest";
import { CONTENT_TYPES } from "../types";
import { DEMO_PROJECTS } from "./demo";

describe("demo data", () => {
  it("every project's split totals exactly 100%", () => {
    for (const p of DEMO_PROJECTS) {
      expect(p.contributors.reduce((s, c) => s + c.shareBps, 0), p.title).toBe(10_000);
    }
  });

  it("covers every supported content type", () => {
    expect(new Set(DEMO_PROJECTS.map((p) => p.type))).toEqual(new Set(CONTENT_TYPES));
  });
});
