import { describe, expect, it, vi } from "vitest";
import { loadDeployment } from "./deployment";

const ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const okFetch = (body: unknown) => vi.fn(async () => ({ ok: true, status: 200, json: async () => body }));

describe("loadDeployment", () => {
  it("reads the address written by the local deploy script", async () => {
    const fetchFn = okFetch({ contract: "CollaborationRegistry", chainId: 31337, address: ADDRESS, deployBlock: 1 });
    const r = await loadDeployment(31337, {}, fetchFn);
    expect(fetchFn).toHaveBeenCalledWith("/deployments/31337.json");
    expect(r).toEqual({ ok: true, deployment: expect.objectContaining({ address: ADDRESS, chainId: 31337, source: "file" }) });
  });

  it("prefers an explicit VITE_REGISTRY_ADDRESS", async () => {
    const fetchFn = okFetch({});
    const r = await loadDeployment(31337, { VITE_REGISTRY_ADDRESS: ADDRESS }, fetchFn);
    expect(r).toEqual({ ok: true, deployment: { chainId: 31337, address: ADDRESS, source: "env" } });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("rejects an invalid explicit address", async () => {
    const r = await loadDeployment(31337, { VITE_REGISTRY_ADDRESS: "0x123" }, okFetch({}));
    expect(r).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("refuses chains other than the local test network", async () => {
    const r = await loadDeployment(1, { VITE_REGISTRY_ADDRESS: ADDRESS }, okFetch({}));
    expect(r).toMatchObject({ ok: false, reason: "unsupported-chain" });
  });

  it("explains how to deploy when no deployment file exists", async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }));
    const r = await loadDeployment(31337, {}, fetchFn);
    expect(r).toMatchObject({ ok: false, reason: "missing" });
    if (!r.ok) expect(r.message).toMatch(/contracts:deploy/);
  });

  it("rejects malformed or mismatched deployment files", async () => {
    expect(await loadDeployment(31337, {}, okFetch({ contract: "Other", chainId: 31337, address: ADDRESS }))).toMatchObject({
      ok: false,
    });
    expect(
      await loadDeployment(31337, {}, okFetch({ contract: "CollaborationRegistry", chainId: 5, address: ADDRESS })),
    ).toMatchObject({ ok: false, reason: "invalid" });
  });
});
