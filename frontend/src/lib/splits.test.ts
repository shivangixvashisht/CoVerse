import { describe, expect, it } from "vitest";
import { bpsToPercent, percentToBps, validateSplitRows } from "./splits";

const A = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const B = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";

describe("share helpers", () => {
  it("converts percentages to basis points and back", () => {
    expect(percentToBps("100")).toBe(10_000);
    expect(percentToBps("33.33")).toBe(3333);
    expect(percentToBps("0.5")).toBe(50);
    expect(percentToBps("12.345")).toBeNull();
    expect(percentToBps("abc")).toBeNull();
    expect(bpsToPercent(3333)).toBe("33.33");
    expect(bpsToPercent(5000)).toBe("50");
  });

  it("accepts a valid split", () => {
    const r = validateSplitRows([
      { address: A, percent: "60" },
      { address: B, percent: "40" },
    ]);
    expect(r.errors).toEqual([]);
    expect(r.splits).toEqual([
      { contributor: A, shareBps: 6000 },
      { contributor: B, shareBps: 4000 },
    ]);
  });

  it("mirrors the contract's rules", () => {
    expect(validateSplitRows([{ address: A, percent: "60" }, { address: B, percent: "30" }]).errors).toContain(
      "Shares must total exactly 100% (currently 90%).",
    );
    expect(
      validateSplitRows([
        { address: A, percent: "50" },
        { address: A.toLowerCase(), percent: "50" },
      ]).errors,
    ).toContain("Row 2: this address is already listed.");
    expect(validateSplitRows([{ address: "0x0000000000000000000000000000000000000000", percent: "100" }]).errors[0]).toMatch(
      /zero address/,
    );
    expect(validateSplitRows([{ address: "0x123", percent: "100" }]).errors[0]).toMatch(/valid wallet address/);
    expect(validateSplitRows([{ address: A, percent: "100" }, { address: B, percent: "0" }]).errors).toContain(
      "Row 2: shares must be greater than 0%.",
    );
    expect(validateSplitRows([]).errors).toContain("Add at least one contributor.");
  });
});
