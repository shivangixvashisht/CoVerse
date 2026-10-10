import { formatEther, type Interface } from "ethers";
import { shortenAddress } from "./format";

export type TxErrorKind =
  | "rejected"
  | "wrong-network"
  | "insufficient-funds"
  | "reverted"
  | "nonce"
  | "network"
  | "unknown";

export interface DescribedError {
  kind: TxErrorKind;
  message: string;
}

/** Thrown before sending a transaction when the wallet is not on the expected chain. */
export class WrongNetworkError extends Error {
  constructor(actual: bigint | number, expected: number) {
    super(`Your wallet is on chain ${String(actual)}, but CoVerse expects chain ${expected} (Hardhat Local).`);
    this.name = "WrongNetworkError";
  }
}

const PROPOSAL_STATUS = ["Pending", "Activated", "Rejected", "Cancelled", "Superseded"];
const eth = (v: unknown) => `${formatEther(v as bigint)} ETH`;

/** Plain-language messages for every custom error the contract can revert with. */
const CONTRACT_ERRORS: Record<string, (args: readonly unknown[]) => string> = {
  EmptyTitle: () => "Give the project a title.",
  NoContributors: () => "Add at least one contributor.",
  TooManyContributors: () => "An agreement can have at most 50 contributors.",
  ZeroAddressContributor: () => "The zero address cannot be a contributor.",
  ZeroShare: ([a]) => `${shortenAddress(String(a))} has a 0% share; every contributor needs a share above 0%.`,
  DuplicateContributor: ([a]) => `${shortenAddress(String(a))} is listed more than once.`,
  SharesMustTotal100Percent: ([t]) => `Shares must total exactly 100% (they total ${Number(t) / 100}%).`,
  NoChange: () => "This proposal is identical to the current agreement.",
  ProjectNotFound: () => "That project does not exist on this chain.",
  VersionNotFound: () => "That agreement version does not exist.",
  ProposalNotFound: () => "That proposal does not exist on this chain.",
  NotAuthorizedProposer: () =>
    "Your wallet can't propose changes to this project. Only contributors in the active agreement can (or the creator, before any agreement is active).",
  NotRequiredApprover: () => "Your wallet is not one of the contributors required to vote on this proposal.",
  AlreadyVoted: () => "Your wallet has already voted on this proposal. Votes can't be changed.",
  ProposalNotPending: ([, s]) => `This proposal is no longer pending (it is ${PROPOSAL_STATUS[Number(s)] ?? "closed"}).`,
  ProposalSuperseded: () => "Another proposal was activated first, so this one can no longer be used.",
  MissingApprovals: ([a, r]) => `Not every required contributor has approved yet (${String(a)} of ${String(r)}).`,
  NotProposer: () => "Only the wallet that created this proposal can cancel it.",
  NoActiveAgreement: () => "This project has no active agreement yet, so it can't receive deposits.",
  VersionMismatch: ([e, a]) =>
    `The agreement changed to version ${String(a)} before your deposit (you reviewed version ${String(e)}). Check the new split and try again.`,
  ZeroDeposit: () => "Enter a deposit amount greater than 0.",
  ZeroClaim: () => "Enter a claim amount greater than 0.",
  NothingToClaim: () => "Your wallet has nothing to claim from this project.",
  InsufficientBalance: ([avail]) => `You can claim at most ${eth(avail)} from this project.`,
  TransferFailed: () => "The payout transfer failed, so nothing was claimed. Your balance is unchanged.",
  DepositNotFound: () => "That deposit does not exist.",
  ReentrantCall: () => "The call was blocked by the contract's reentrancy guard.",
};

type ErrorLike = {
  code?: unknown;
  message?: unknown;
  shortMessage?: unknown;
  reason?: unknown;
  data?: unknown;
  revert?: { name?: string; args?: readonly unknown[] } | null;
  info?: { error?: ErrorLike };
  error?: ErrorLike;
};

function chain(err: unknown): ErrorLike[] {
  const out: ErrorLike[] = [];
  let cur = err as ErrorLike | undefined;
  for (let i = 0; cur && i < 6; i++) {
    out.push(cur);
    cur = cur.info?.error ?? cur.error;
  }
  return out;
}

function findRevertData(errs: ErrorLike[]): string | null {
  for (const e of errs) {
    const d = e.data as unknown;
    if (typeof d === "string" && d.startsWith("0x") && d.length >= 10) return d;
    if (d && typeof d === "object" && typeof (d as { data?: unknown }).data === "string") {
      return (d as { data: string }).data;
    }
  }
  return null;
}

/** Turn any wallet / provider / contract error into a kind and a message a person can act on. */
export function describeTxError(err: unknown, iface?: Interface | null): DescribedError {
  if (err instanceof WrongNetworkError) return { kind: "wrong-network", message: err.message };
  const errs = chain(err);
  const text = errs.map((e) => `${String(e.message ?? "")} ${String(e.shortMessage ?? "")}`).join(" ");

  if (errs.some((e) => e.code === "ACTION_REJECTED" || e.code === 4001)) {
    return { kind: "rejected", message: "You rejected the request in MetaMask. Nothing was sent." };
  }
  if (errs.some((e) => e.code === "INSUFFICIENT_FUNDS") || /insufficient funds/i.test(text)) {
    return {
      kind: "insufficient-funds",
      message: "This wallet doesn't have enough test ETH for this amount plus gas. Use a funded Hardhat test account.",
    };
  }
  if (/nonce too (high|low)|nonce has already been used|invalid nonce/i.test(text)) {
    return {
      kind: "nonce",
      message:
        "MetaMask's transaction count doesn't match the local chain (usually after restarting `hardhat node`). In MetaMask open Settings → Advanced → Clear activity tab data, then try again.",
    };
  }
  if (errs.some((e) => e.code === "NETWORK_ERROR") && /network changed/i.test(text)) {
    return { kind: "wrong-network", message: "Your wallet switched networks. Switch back to Hardhat Local and retry." };
  }

  // Custom contract errors: ethers decodes these when it knows the ABI; otherwise decode the data.
  for (const e of errs) {
    if (e.revert?.name && CONTRACT_ERRORS[e.revert.name]) {
      return { kind: "reverted", message: CONTRACT_ERRORS[e.revert.name]!(e.revert.args ?? []) };
    }
  }
  const data = findRevertData(errs);
  if (data && iface) {
    try {
      const parsed = iface.parseError(data);
      if (parsed && CONTRACT_ERRORS[parsed.name]) {
        return { kind: "reverted", message: CONTRACT_ERRORS[parsed.name]!(parsed.args) };
      }
    } catch {
      // fall through
    }
  }
  if (errs.some((e) => e.code === "CALL_EXCEPTION")) {
    const reason = errs.map((e) => e.reason).find((r) => typeof r === "string" && r);
    return { kind: "reverted", message: `The contract rejected the transaction${reason ? `: ${String(reason)}` : "."}` };
  }
  if (/failed to fetch|could not detect network|ECONNREFUSED|request failed/i.test(text)) {
    return {
      kind: "network",
      message: "Can't reach the local blockchain. Is `npm run contracts:node` still running on http://127.0.0.1:8545?",
    };
  }
  const short = errs.map((e) => e.shortMessage).find((m) => typeof m === "string" && m);
  return { kind: "unknown", message: String(short ?? errs[0]?.message ?? "Something went wrong.") };
}
