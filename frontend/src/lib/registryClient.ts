import { Contract, type ContractRunner, type Interface } from "ethers";
import abi from "../contracts/CollaborationRegistry.abi.json";

/**
 * Thin, typed access to the deployed CollaborationRegistry contract.
 *
 * Every value returned here is read from contract state via its public getters — nothing
 * is inferred or cached on the client. Writes return the wallet's transaction response;
 * the contract enforces every rule (unanimity, authorisation, share validation, balances).
 */

export const REGISTRY_ABI = abi;

export type ProposalStatus = "Pending" | "Activated" | "Rejected" | "Cancelled" | "Superseded";
export type VoteValue = "None" | "Approved" | "Rejected";

const PROPOSAL_STATUS: ProposalStatus[] = ["Pending", "Activated", "Rejected", "Cancelled", "Superseded"];
const VOTE: VoteValue[] = ["None", "Approved", "Rejected"];

export interface SplitEntry {
  contributor: string;
  shareBps: number;
}

export interface ChainProject {
  id: bigint;
  creator: string;
  title: string;
  contentType: number;
  createdAt: number;
  activeVersion: number;
}

export interface AgreementVersionView {
  version: number;
  proposalId: bigint;
  activatedAt: number;
  activatedBlock: number;
  splits: SplitEntry[];
}

export interface ApproverVote {
  account: string;
  vote: VoteValue;
}

export interface ProposalView {
  id: bigint;
  projectId: bigint;
  proposer: string;
  baseVersion: number;
  /** Effective status as reported by the contract (`Superseded` is derived on-chain). */
  status: ProposalStatus;
  createdAt: number;
  approvalCount: number;
  requiredCount: number;
  splits: SplitEntry[];
  /** Every required approver with their vote, read from `voteOf`. */
  approvers: ApproverVote[];
}

export interface DepositView {
  id: bigint;
  version: number;
  depositor: string;
  amount: bigint;
  depositedAt: number;
}

export interface AccountRevenue {
  claimable: bigint;
  earned: bigint;
  claimed: bigint;
  earnedByVersion: { version: number; amount: bigint }[];
}

export interface ProjectDetail {
  project: ChainProject;
  versions: AgreementVersionView[];
  proposals: ProposalView[];
  deposits: DepositView[];
  revenue: { deposited: bigint; claimed: bigint; byVersion: { version: number; amount: bigint }[] };
  account: AccountRevenue | null;
}

/** The subset of an ethers transaction response the UI relies on. */
export interface TxHandle {
  hash: string;
  wait(): Promise<{ status?: number | null } | null>;
}

export interface RegistryApi {
  address: string;
  chainId: number;
  interface: Interface | null;
  listProjects(): Promise<ChainProject[]>;
  loadProject(projectId: bigint, account: string | null): Promise<ProjectDetail>;
  createProject(title: string, contentType: number, splits: SplitEntry[]): Promise<TxHandle>;
  proposeAgreement(projectId: bigint, splits: SplitEntry[]): Promise<TxHandle>;
  approveProposal(proposalId: bigint): Promise<TxHandle>;
  rejectProposal(proposalId: bigint): Promise<TxHandle>;
  cancelProposal(proposalId: bigint): Promise<TxHandle>;
  activateProposal(proposalId: bigint): Promise<TxHandle>;
  deposit(projectId: bigint, expectedVersion: number, amountWei: bigint): Promise<TxHandle>;
  claim(projectId: bigint, amountWei: bigint): Promise<TxHandle>;
  claimAll(projectId: bigint): Promise<TxHandle>;
}

type Raw = Record<string | number, unknown>;
const num = (v: unknown) => Number(v as bigint);
const big = (v: unknown) => v as bigint;
const toSplits = (raw: unknown): SplitEntry[] =>
  (raw as Raw[]).map((s) => ({ contributor: s.contributor as string, shareBps: num(s.shareBps) }));

function toProject(id: bigint, p: Raw): ChainProject {
  return {
    id,
    creator: p.creator as string,
    title: p.title as string,
    contentType: num(p.contentType),
    createdAt: num(p.createdAt),
    activeVersion: num(p.activeVersion),
  };
}

export function registryContract(address: string, runner: ContractRunner): Contract {
  return new Contract(address, REGISTRY_ABI, runner);
}

export async function listProjects(c: Contract): Promise<ChainProject[]> {
  const count = big(await c.projectCount());
  const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i + 1));
  const raws = await Promise.all(ids.map((id) => c.getProject(id) as Promise<Raw>));
  return raws.map((p, i) => toProject(ids[i]!, p));
}

/**
 * Load everything shown for one project. Proposals and deposits are found by scanning the
 * contract's global counters (the contract has no per-project index); fine for a local demo,
 * an indexer is needed at scale.
 */
export async function loadProject(c: Contract, projectId: bigint, account: string | null): Promise<ProjectDetail> {
  const project = toProject(projectId, (await c.getProject(projectId)) as Raw);

  const versionNumbers = Array.from({ length: project.activeVersion }, (_, i) => i + 1);
  const versions = await Promise.all(
    versionNumbers.map(async (version) => {
      const [info, splits] = (await c.getAgreement(projectId, version)) as [Raw, unknown];
      return {
        version,
        proposalId: big(info.proposalId),
        activatedAt: num(info.activatedAt),
        activatedBlock: num(info.activatedBlock),
        splits: toSplits(splits),
      };
    }),
  );

  const proposalCount = Number(big(await c.proposalCount()));
  const allProposals = await Promise.all(
    Array.from({ length: proposalCount }, (_, i) => BigInt(i + 1)).map(async (id) => ({
      id,
      raw: (await c.getProposal(id)) as Raw,
    })),
  );
  const proposals = await Promise.all(
    allProposals
      .filter(({ raw }) => big(raw.projectId) === projectId)
      .map(async ({ id, raw }) => {
        const [splits, required] = await Promise.all([c.getProposedSplits(id), c.getRequiredApprovers(id) as Promise<string[]>]);
        const votes = await Promise.all(required.map((a) => c.voteOf(id, a) as Promise<bigint>));
        return {
          id,
          projectId,
          proposer: raw.proposer as string,
          baseVersion: num(raw.baseVersion),
          status: PROPOSAL_STATUS[num(raw.status)] ?? "Pending",
          createdAt: num(raw.createdAt),
          approvalCount: num(raw.approvalCount),
          requiredCount: num(raw.requiredCount),
          splits: toSplits(splits),
          approvers: required.map((a, i) => ({ account: a, vote: VOTE[Number(votes[i])] ?? "None" })),
        } satisfies ProposalView;
      }),
  );
  proposals.reverse(); // newest first

  const depositCount = Number(big(await c.depositCount()));
  const allDeposits = await Promise.all(
    Array.from({ length: depositCount }, (_, i) => BigInt(i + 1)).map(async (id) => ({
      id,
      raw: (await c.getDeposit(id)) as Raw,
    })),
  );
  const deposits = allDeposits
    .filter(({ raw }) => big(raw.projectId) === projectId)
    .map(({ id, raw }) => ({
      id,
      version: num(raw.version),
      depositor: raw.depositor as string,
      amount: big(raw.amount),
      depositedAt: num(raw.depositedAt),
    }))
    .reverse();

  const [[deposited, claimed], byVersionAmounts] = await Promise.all([
    c.projectRevenue(projectId) as Promise<[bigint, bigint]>,
    Promise.all(versionNumbers.map((v) => c.versionRevenue(projectId, v) as Promise<bigint>)),
  ]);

  let accountRevenue: AccountRevenue | null = null;
  if (account) {
    const [claimableNow, [earned, claimedByAccount], perVersion] = await Promise.all([
      c.claimable(projectId, account) as Promise<bigint>,
      c.balanceOf(projectId, account) as Promise<[bigint, bigint]>,
      Promise.all(versionNumbers.map((v) => c.earnedInVersion(projectId, v, account) as Promise<bigint>)),
    ]);
    accountRevenue = {
      claimable: claimableNow,
      earned,
      claimed: claimedByAccount,
      earnedByVersion: versionNumbers.map((version, i) => ({ version, amount: perVersion[i]! })),
    };
  }

  return {
    project,
    versions,
    proposals,
    deposits,
    revenue: {
      deposited,
      claimed,
      byVersion: versionNumbers.map((version, i) => ({ version, amount: byVersionAmounts[i]! })),
    },
    account: accountRevenue,
  };
}

/**
 * Build the API used by the UI. `reader` is used for calls; `getSigner` must return a signer for
 * the connected wallet, and `assertChain` must throw if the wallet is not on the expected chain —
 * it runs before every transaction.
 */
export function createRegistryApi(opts: {
  address: string;
  chainId: number;
  reader: ContractRunner;
  getSigner: () => Promise<ContractRunner>;
  assertChain: () => Promise<void>;
}): RegistryApi {
  const read = registryContract(opts.address, opts.reader);
  const write = async () => {
    await opts.assertChain();
    return registryContract(opts.address, await opts.getSigner());
  };
  return {
    address: opts.address,
    chainId: opts.chainId,
    interface: read.interface,
    listProjects: () => listProjects(read),
    loadProject: (id, account) => loadProject(read, id, account),
    createProject: async (title, type, splits) => (await write()).createProject(title, type, splits),
    proposeAgreement: async (id, splits) => (await write()).proposeAgreement(id, splits),
    approveProposal: async (id) => (await write()).approveProposal(id),
    rejectProposal: async (id) => (await write()).rejectProposal(id),
    cancelProposal: async (id) => (await write()).cancelProposal(id),
    activateProposal: async (id) => (await write()).activateProposal(id),
    // `expectedVersion` is passed through so the contract rejects the deposit if the
    // agreement changed after the user reviewed it.
    deposit: async (id, expectedVersion, amountWei) =>
      (await write()).deposit(id, expectedVersion, { value: amountWei }),
    // Claims always withdraw the signer's (connected wallet's) own balance — the contract
    // pays msg.sender only; there is no recipient parameter.
    claim: async (id, amountWei) => (await write()).claim(id, amountWei),
    claimAll: async (id) => (await write()).claimAll(id),
  };
}
