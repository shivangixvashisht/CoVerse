import { isAddress } from "ethers";
import { isSupportedChain } from "./network";

export interface Deployment {
  chainId: number;
  address: string;
  source: "env" | "file";
  deployBlock?: number;
  deployedAt?: string;
}

export type DeploymentResult =
  | { ok: true; deployment: Deployment }
  | { ok: false; reason: "missing" | "invalid" | "unsupported-chain"; message: string };

type Env = Record<string, string | boolean | undefined>;
type FetchLike = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/**
 * Resolve where the CollaborationRegistry contract lives for `chainId`.
 *
 * 1. `VITE_REGISTRY_ADDRESS` (explicit override, chain = `VITE_REGISTRY_CHAIN_ID` or 31337), else
 * 2. `/deployments/<chainId>.json`, written by `npm run contracts:deploy` (git-ignored, because the
 *    address changes whenever the local node restarts).
 *
 * Nothing is hardcoded; the result is validated and only test chains are accepted.
 */
export async function loadDeployment(chainId: number, env: Env, fetchFn: FetchLike): Promise<DeploymentResult> {
  if (!isSupportedChain(chainId)) {
    return {
      ok: false,
      reason: "unsupported-chain",
      message: `Chain ${chainId} is not supported. CoVerse only runs on the local Hardhat test network in this milestone.`,
    };
  }

  const envAddress = typeof env.VITE_REGISTRY_ADDRESS === "string" ? env.VITE_REGISTRY_ADDRESS.trim() : "";
  if (envAddress) {
    const envChain = Number(env.VITE_REGISTRY_CHAIN_ID || 31337);
    if (!isAddress(envAddress)) {
      return { ok: false, reason: "invalid", message: `VITE_REGISTRY_ADDRESS "${envAddress}" is not a valid address.` };
    }
    if (envChain !== chainId) {
      return {
        ok: false,
        reason: "missing",
        message: `VITE_REGISTRY_ADDRESS is configured for chain ${envChain}, but your wallet is on chain ${chainId}.`,
      };
    }
    return { ok: true, deployment: { chainId, address: envAddress, source: "env" } };
  }

  let res: Awaited<ReturnType<FetchLike>>;
  try {
    res = await fetchFn(`/deployments/${chainId}.json`);
  } catch {
    return { ok: false, reason: "missing", message: "Could not load the local deployment file." };
  }
  if (!res.ok) {
    return {
      ok: false,
      reason: "missing",
      message: "No local deployment found. Start `npm run contracts:node`, then run `npm run contracts:deploy`.",
    };
  }
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return {
      ok: false,
      reason: "missing",
      message: "No valid local deployment found. Start `npm run contracts:node`, then run `npm run contracts:deploy`.",
    };
  }
  const d = data as Partial<Deployment> & { contract?: string };
  if (d.contract !== "CollaborationRegistry" || typeof d.address !== "string" || !isAddress(d.address)) {
    return { ok: false, reason: "invalid", message: "The deployment file is malformed. Re-run the deploy script." };
  }
  if (Number(d.chainId) !== chainId) {
    return {
      ok: false,
      reason: "invalid",
      message: `The deployment file is for chain ${String(d.chainId)}, not ${chainId}. Re-run the deploy script.`,
    };
  }
  return {
    ok: true,
    deployment: { chainId, address: d.address, source: "file", deployBlock: d.deployBlock, deployedAt: d.deployedAt },
  };
}
