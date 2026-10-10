import { describe, expect, it } from "vitest";
import { formatBps, formatUsd, initials, shortenAddress, totalBps } from "./format";
import { chainName, isTestChain } from "./chains";

describe("format helpers", () => {
  it("formats basis points as percentages", () => {
    expect(formatBps(10_000)).toBe("100%");
    expect(formatBps(1250)).toBe("12.5%");
    expect(formatBps(500)).toBe("5%");
  });

  it("formats USD without cents", () => {
    expect(formatUsd(18420)).toBe("$18,420");
  });

  it("shortens valid addresses and leaves other strings alone", () => {
    expect(shortenAddress("0x1234567890abcdef1234567890abcdef12345678")).toBe("0x1234…5678");
    expect(shortenAddress("not-an-address")).toBe("not-an-address");
  });

  it("builds initials and sums shares", () => {
    expect(initials("Aria Nwosu")).toBe("AN");
    expect(totalBps([{ shareBps: 6000 }, { shareBps: 4000 }])).toBe(10_000);
  });

  it("names chains and flags test networks", () => {
    expect(chainName(31337n)).toBe("Hardhat Local");
    expect(chainName(999)).toBe("Chain 999");
    expect(isTestChain(11155111n)).toBe(true);
    expect(isTestChain(1n)).toBe(false);
  });
});
