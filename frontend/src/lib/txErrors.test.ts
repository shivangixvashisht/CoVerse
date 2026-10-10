import { Interface } from "ethers";
import { describe, expect, it } from "vitest";
import { REGISTRY_ABI } from "./registryClient";
import { describeTxError, WrongNetworkError } from "./txErrors";

const iface = new Interface(REGISTRY_ABI);
const revert = (name: string, args: unknown[] = []) => ({
  code: "CALL_EXCEPTION",
  data: iface.encodeErrorResult(name, args),
  message: "execution reverted",
});

describe("describeTxError", () => {
  it("recognises a wallet rejection (ethers and raw EIP-1193 forms)", () => {
    expect(describeTxError({ code: "ACTION_REJECTED" }).kind).toBe("rejected");
    expect(describeTxError({ code: "UNKNOWN_ERROR", error: { code: 4001, message: "User denied" } })).toEqual({
      kind: "rejected",
      message: "You rejected the request in MetaMask. Nothing was sent.",
    });
  });

  it("recognises insufficient test ETH", () => {
    expect(describeTxError({ code: "INSUFFICIENT_FUNDS" }).kind).toBe("insufficient-funds");
    expect(describeTxError({ message: "sender doesn't have enough funds: insufficient funds for gas * price + value" }).kind).toBe(
      "insufficient-funds",
    );
  });

  it("recognises the wrong network", () => {
    expect(describeTxError(new WrongNetworkError(1, 31337))).toMatchObject({ kind: "wrong-network" });
    expect(describeTxError({ code: "NETWORK_ERROR", message: "network changed: 31337 => 1" }).kind).toBe("wrong-network");
  });

  it("explains a stale MetaMask nonce after a node restart", () => {
    expect(describeTxError({ message: "Nonce too high. Expected nonce to be 0 but got 4." }).kind).toBe("nonce");
  });

  it("decodes the contract's custom errors into plain language", () => {
    expect(describeTxError(revert("MissingApprovals", [1, 3]), iface).message).toBe(
      "Not every required contributor has approved yet (1 of 3).",
    );
    expect(describeTxError(revert("VersionMismatch", [1, 2]), iface).message).toMatch(/changed to version 2/);
    expect(describeTxError(revert("AlreadyVoted", ["0x70997970C51812dc3A010C7d01b50e0d17dc79C8"]), iface).message).toMatch(
      /already voted/,
    );
    expect(describeTxError(revert("SharesMustTotal100Percent", [9000]), iface).message).toBe(
      "Shares must total exactly 100% (they total 90%).",
    );
    expect(describeTxError(revert("InsufficientBalance", [10n ** 17n, 10n ** 18n]), iface).message).toBe(
      "You can claim at most 0.1 ETH from this project.",
    );
  });

  it("uses an already-decoded revert from ethers", () => {
    expect(describeTxError({ code: "CALL_EXCEPTION", revert: { name: "NothingToClaim", args: [] } }).message).toMatch(
      /nothing to claim/,
    );
  });

  it("has a message for every custom error in the ABI", () => {
    const names = REGISTRY_ABI.filter((e) => e.type === "error").map((e) => e.name as string);
    for (const name of names) {
      const inputs = iface.getError(name)!.inputs.map((i) => (i.type === "address" ? "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" : 1));
      const d = describeTxError(revert(name, inputs), iface);
      expect(d.kind, name).toBe("reverted");
      expect(d.message, name).not.toMatch(/^The contract rejected/);
    }
  });

  it("explains an unreachable local node", () => {
    expect(describeTxError({ message: "Failed to fetch" }).kind).toBe("network");
  });
});
