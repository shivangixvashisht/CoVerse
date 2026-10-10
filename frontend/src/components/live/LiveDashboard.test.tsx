import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Interface, parseEther } from "ethers";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { REGISTRY_ABI, type ProjectDetail, type ProposalView, type RegistryApi, type TxHandle } from "../../lib/registryClient";
import { LiveDashboard } from "./LiveDashboard";
import { LiveContext } from "./liveContext";

// TEST-ONLY fake of the contract client. The real client is exercised against the real
// contract in contracts/test/FrontendClient.test.ts.

const ALICE = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const BOB = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
const CAROL = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";
const OUTSIDER = "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65";
const iface = new Interface(REGISTRY_ABI);

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const confirmedTx = (hash = "0xabc123def4567890"): TxHandle => ({ hash, wait: async () => ({ status: 1 }) });

function proposal(overrides: Partial<ProposalView> = {}): ProposalView {
  return {
    id: 2n,
    projectId: 1n,
    proposer: ALICE,
    baseVersion: 1,
    status: "Pending",
    createdAt: 1_700_000_000,
    approvalCount: 1,
    requiredCount: 3,
    splits: [
      { contributor: ALICE, shareBps: 6000 },
      { contributor: CAROL, shareBps: 4000 },
    ],
    approvers: [
      { account: ALICE, vote: "Approved" },
      { account: BOB, vote: "None" },
      { account: CAROL, vote: "None" },
    ],
    ...overrides,
  };
}

function detail(overrides: Partial<ProjectDetail> = {}): ProjectDetail {
  return {
    project: { id: 1n, creator: ALICE, title: "Midnight Sessions", contentType: 0, createdAt: 1_700_000_000, activeVersion: 1 },
    versions: [
      {
        version: 1,
        proposalId: 1n,
        activatedAt: 1_700_000_100,
        activatedBlock: 5,
        splits: [
          { contributor: ALICE, shareBps: 5000 },
          { contributor: BOB, shareBps: 5000 },
        ],
      },
    ],
    proposals: [proposal()],
    deposits: [{ id: 1n, version: 1, depositor: OUTSIDER, amount: parseEther("1"), depositedAt: 1_700_000_200 }],
    revenue: { deposited: parseEther("1"), claimed: 0n, byVersion: [{ version: 1, amount: parseEther("1") }] },
    account: { claimable: parseEther("0.5"), earned: parseEther("0.5"), claimed: 0n, earnedByVersion: [{ version: 1, amount: parseEther("0.5") }] },
    ...overrides,
  };
}

function fakeApi(d: ProjectDetail = detail(), overrides: Partial<RegistryApi> = {}): RegistryApi {
  return {
    address: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    chainId: 31337,
    interface: iface,
    listProjects: vi.fn(async () => [d.project]),
    loadProject: vi.fn(async () => d),
    createProject: vi.fn(async () => confirmedTx()),
    proposeAgreement: vi.fn(async () => confirmedTx()),
    approveProposal: vi.fn(async () => confirmedTx()),
    rejectProposal: vi.fn(async () => confirmedTx()),
    cancelProposal: vi.fn(async () => confirmedTx()),
    activateProposal: vi.fn(async () => confirmedTx()),
    deposit: vi.fn(async () => confirmedTx()),
    claim: vi.fn(async () => confirmedTx()),
    claimAll: vi.fn(async () => confirmedTx()),
    ...overrides,
  };
}

function Harness({ api, account, walletBalance }: { api: RegistryApi; account: string; walletBalance: bigint | null }) {
  const [refreshKey, setKey] = useState(0);
  return (
    <LiveContext.Provider value={{ api, account, refreshKey, refresh: () => setKey((k) => k + 1), walletBalance }}>
      <LiveDashboard />
    </LiveContext.Provider>
  );
}

function renderLive(api: RegistryApi, account: string, walletBalance: bigint | null = parseEther("100")) {
  render(<Harness api={api} account={account} walletBalance={walletBalance} />);
}

const pendingCard = async () => screen.findByRole("article", { name: "Proposal 2" });

describe("live dashboard: proposals", () => {
  it("shows every required approver and their vote exactly as read from the contract", async () => {
    renderLive(fakeApi(), BOB);
    const card = await pendingCard();
    expect(within(card).getByTestId("proposal-status")).toHaveTextContent("Pending");
    expect(within(card).getByText("1 of 3")).toBeInTheDocument();
    const rows = within(card).getAllByTestId("approver");
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringMatching(/0x7099…79C8.*Approved/),
      expect.stringMatching(/0x3C44…93BC.*You.*Not voted/),
      expect.stringMatching(/0x90F7…b906.*Not voted/),
    ]);
    // The proposed change against version 1 is spelled out.
    expect(within(card).getByText("was 50%")).toBeInTheDocument();
    expect(within(card).getByText("added")).toBeInTheDocument();
    expect(within(card).getByText(/removed \(was 50%\)/)).toBeInTheDocument();
  });

  it("offers approve/reject only to a required approver who has not voted", async () => {
    renderLive(fakeApi(), BOB);
    const card = await pendingCard();
    expect(within(card).getByRole("button", { name: /approve with my wallet/i })).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: /^reject$/i })).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: /activate/i })).not.toBeInTheDocument();
  });

  it("does not offer voting to a wallet that already voted or is not required", async () => {
    renderLive(fakeApi(), ALICE);
    const card = await pendingCard();
    expect(within(card).queryByRole("button", { name: /approve with my wallet/i })).not.toBeInTheDocument();
    expect(within(card).getByText(/you approved this proposal/i)).toBeInTheDocument();
    // The proposer can cancel.
    expect(within(card).getByRole("button", { name: /cancel proposal/i })).toBeInTheDocument();
  });

  it("tells an outsider they are not a required approver", async () => {
    renderLive(fakeApi(), OUTSIDER);
    const card = await pendingCard();
    expect(within(card).queryByRole("button", { name: /approve/i })).not.toBeInTheDocument();
    expect(within(card).getByText(/not a required approver/i)).toBeInTheDocument();
    expect(screen.getByText(/only contributors in the active agreement can propose/i)).toBeInTheDocument();
  });

  it("offers activation only when the contract reports every approval", async () => {
    const full = proposal({
      approvalCount: 3,
      approvers: [
        { account: ALICE, vote: "Approved" },
        { account: BOB, vote: "Approved" },
        { account: CAROL, vote: "Approved" },
      ],
    });
    const api = fakeApi(detail({ proposals: [full] }));
    renderLive(api, OUTSIDER);
    const card = await pendingCard();
    await userEvent.click(within(card).getByRole("button", { name: /activate version 2/i }));
    expect(api.activateProposal).toHaveBeenCalledWith(2n);
  });

  it("walks a vote through signing → pending → confirmed, then re-reads the chain", async () => {
    const send = deferred<TxHandle>();
    const mined = deferred<{ status: number }>();
    const api = fakeApi(detail(), { approveProposal: vi.fn(() => send.promise) });
    renderLive(api, BOB);
    const card = await pendingCard();
    await userEvent.click(within(card).getByRole("button", { name: /approve with my wallet/i }));

    expect(within(card).getByRole("status")).toHaveTextContent(/confirm in MetaMask/);
    expect(api.approveProposal).toHaveBeenCalledWith(2n);
    await act(async () => send.resolve({ hash: "0xfeedbeef00112233", wait: () => mined.promise }));
    expect(within(card).getByRole("status")).toHaveTextContent(/pending on-chain.*0xfeedbeef/);

    const loadsBefore = vi.mocked(api.loadProject).mock.calls.length;
    await act(async () => mined.resolve({ status: 1 }));
    await waitFor(() => expect(within(card).getByRole("status")).toHaveTextContent(/Approve: confirmed/));
    await waitFor(() => expect(vi.mocked(api.loadProject).mock.calls.length).toBeGreaterThan(loadsBefore));
  });

  it("explains a wallet rejection", async () => {
    const api = fakeApi(detail(), {
      rejectProposal: vi.fn(async () => {
        throw { code: "ACTION_REJECTED", message: "user rejected action" };
      }),
    });
    renderLive(api, BOB);
    const card = await pendingCard();
    await userEvent.click(within(card).getByRole("button", { name: /^reject$/i }));
    expect(await within(card).findByRole("alert")).toHaveTextContent("Reject failed: You rejected the request in MetaMask");
  });

  it("explains a contract revert using the contract's own error", async () => {
    const api = fakeApi(detail(), {
      approveProposal: vi.fn(async () => {
        throw { code: "CALL_EXCEPTION", data: iface.encodeErrorResult("ProposalSuperseded", [2]) };
      }),
    });
    renderLive(api, BOB);
    const card = await pendingCard();
    await userEvent.click(within(card).getByRole("button", { name: /approve with my wallet/i }));
    expect(await within(card).findByRole("alert")).toHaveTextContent(/Another proposal was activated first/);
  });

  it("reports a mined-but-reverted transaction as failed, not confirmed", async () => {
    const api = fakeApi(detail(), { approveProposal: vi.fn(async () => ({ hash: "0x1", wait: async () => ({ status: 0 }) })) });
    renderLive(api, BOB);
    const card = await pendingCard();
    await userEvent.click(within(card).getByRole("button", { name: /approve with my wallet/i }));
    expect(await within(card).findByRole("alert")).toHaveTextContent(/reverted/);
  });
});

describe("live dashboard: revenue", () => {
  it("deposits against the active agreement version", async () => {
    const api = fakeApi();
    renderLive(api, OUTSIDER);
    await userEvent.type(await screen.findByLabelText(/deposit amount/i), "0.25");
    await userEvent.click(screen.getByRole("button", { name: /^deposit$/i }));
    expect(api.deposit).toHaveBeenCalledWith(1n, 1, parseEther("0.25"));
    expect(await screen.findByText(/Deposit: confirmed/)).toBeInTheDocument();
  });

  it("stops a deposit the wallet cannot afford before asking MetaMask", async () => {
    const api = fakeApi();
    renderLive(api, OUTSIDER, parseEther("0.1"));
    await userEvent.type(await screen.findByLabelText(/deposit amount/i), "1");
    await userEvent.click(screen.getByRole("button", { name: /^deposit$/i }));
    expect(await screen.findByText(/Not enough test ETH/)).toBeInTheDocument();
    expect(api.deposit).not.toHaveBeenCalled();
  });

  it("rejects invalid deposit amounts", async () => {
    const api = fakeApi();
    renderLive(api, OUTSIDER);
    await userEvent.type(await screen.findByLabelText(/deposit amount/i), "0");
    await userEvent.click(screen.getByRole("button", { name: /^deposit$/i }));
    expect(await screen.findByText(/greater than 0/)).toBeInTheDocument();
    expect(api.deposit).not.toHaveBeenCalled();
  });

  it("explains insufficient test ETH reported by the wallet", async () => {
    const api = fakeApi(detail(), {
      deposit: vi.fn(async () => {
        throw { code: "INSUFFICIENT_FUNDS", message: "insufficient funds for intrinsic transaction cost" };
      }),
    });
    renderLive(api, OUTSIDER, null);
    await userEvent.type(await screen.findByLabelText(/deposit amount/i), "5");
    await userEvent.click(screen.getByRole("button", { name: /^deposit$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/doesn't have enough test ETH/);
  });

  it("shows and claims only the connected wallet's own balance", async () => {
    const api = fakeApi();
    renderLive(api, BOB);
    expect(await screen.findByTestId("claimable")).toHaveTextContent("0.5 ETH");
    expect(vi.mocked(api.loadProject)).toHaveBeenCalledWith(1n, BOB);
    await userEvent.click(screen.getByRole("button", { name: /claim all/i }));
    expect(api.claimAll).toHaveBeenCalledWith(1n);
  });

  it("blocks a partial claim above the claimable balance", async () => {
    const api = fakeApi();
    renderLive(api, BOB);
    await userEvent.type(await screen.findByLabelText(/partial claim amount/i), "0.6");
    await userEvent.click(screen.getByRole("button", { name: /claim amount/i }));
    expect(await screen.findByText(/at most 0.5 ETH/)).toBeInTheDocument();
    expect(api.claim).not.toHaveBeenCalled();
  });
});

describe("live dashboard: creating projects", () => {
  it("validates shares before sending and submits basis points", async () => {
    const api = fakeApi(detail(), { listProjects: vi.fn(async () => []) });
    renderLive(api, ALICE);
    await userEvent.type(await screen.findByLabelText("Title"), "Paper Satellites");
    const pct = screen.getByLabelText("Contributor 1 share percent");
    await userEvent.clear(pct);
    await userEvent.type(pct, "60");
    await userEvent.click(screen.getByRole("button", { name: /create project/i }));
    expect(await screen.findByText(/must total exactly 100% \(currently 60%\)/)).toBeInTheDocument();
    expect(api.createProject).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /add contributor/i }));
    await userEvent.type(screen.getByLabelText("Contributor 2 wallet address"), BOB);
    await userEvent.type(screen.getByLabelText("Contributor 2 share percent"), "40");
    await userEvent.click(screen.getByRole("button", { name: /create project/i }));
    expect(api.createProject).toHaveBeenCalledWith("Paper Satellites", 0, [
      { contributor: ALICE, shareBps: 6000 },
      { contributor: BOB, shareBps: 4000 },
    ]);
  });
});
