import { expect } from "chai";
import { artifacts, ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { readFileSync } from "fs";
import { FRONTEND_ABI_PATH } from "../scripts/export-abi";
// The browser app's real contract client, exercised here against the real contract.
import { createRegistryApi, type RegistryApi } from "../../frontend/src/lib/registryClient";
import { describeTxError, WrongNetworkError } from "../../frontend/src/lib/txErrors";

const ETH = (n: string) => ethers.parseEther(n);

describe("Frontend contract client (against the real contract)", () => {
  async function fixture() {
    const [creator, alice, bob, carol, payer, outsider] = await ethers.getSigners();
    const registry = await ethers.deployContract("CollaborationRegistry");
    const address = await registry.getAddress();
    // One API per wallet, exactly as the browser builds it for the connected account.
    const apiFor = (signer: (typeof creator), chainOk = true): RegistryApi =>
      createRegistryApi({
        address,
        chainId: 31337,
        reader: ethers.provider,
        getSigner: async () => signer,
        assertChain: async () => {
          if (!chainOk) throw new WrongNetworkError(1, 31337);
        },
      });
    return { registry, creator, alice, bob, carol, payer, outsider, apiFor };
  }

  const confirm = async (p: Promise<{ wait(): Promise<{ status?: number | null } | null> }>) => {
    const receipt = await (await p).wait();
    expect(receipt?.status).to.equal(1);
  };

  it("ships an ABI to the frontend that matches the compiled contract", async () => {
    const { abi } = await artifacts.readArtifact("CollaborationRegistry");
    const frontendAbi = JSON.parse(readFileSync(FRONTEND_ABI_PATH, "utf8"));
    expect(frontendAbi, "Run `npm run contracts:export-abi` after changing the contract").to.deep.equal(abi);
  });

  it("runs the full create → approve → activate → amend → deposit → claim flow and reads state back accurately", async () => {
    const { creator, alice, bob, carol, payer, apiFor } = await loadFixture(fixture);
    const asCreator = apiFor(creator);

    await confirm(
      asCreator.createProject("Tides of the Salt Marsh", 2, [
        { contributor: alice.address, shareBps: 6000 },
        { contributor: bob.address, shareBps: 4000 },
      ]),
    );
    let projects = await asCreator.listProjects();
    expect(projects).to.have.length(1);
    expect(projects[0]).to.include({ title: "Tides of the Salt Marsh", contentType: 2, activeVersion: 0, creator: creator.address });

    // Pending initial proposal: required approvers and votes come straight from contract state.
    let detail = await apiFor(alice).loadProject(1n, alice.address);
    expect(detail.versions).to.have.length(0);
    expect(detail.proposals).to.have.length(1);
    const initial = detail.proposals[0]!;
    expect(initial).to.include({ status: "Pending", baseVersion: 0, approvalCount: 0, requiredCount: 2 });
    expect(initial.approvers).to.deep.equal([
      { account: alice.address, vote: "None" },
      { account: bob.address, vote: "None" },
    ]);

    await confirm(apiFor(alice).approveProposal(initial.id));
    detail = await apiFor(alice).loadProject(1n, alice.address);
    expect(detail.proposals[0]!.approvers).to.deep.equal([
      { account: alice.address, vote: "Approved" },
      { account: bob.address, vote: "None" },
    ]);

    // Activation before everyone approved is rejected by the contract, with a readable message.
    const early = await apiFor(alice).activateProposal(initial.id).catch((e: unknown) => e);
    expect(describeTxError(early, asCreator.interface).message).to.equal(
      "Not every required contributor has approved yet (1 of 2).",
    );

    await confirm(apiFor(bob).approveProposal(initial.id));
    await confirm(apiFor(payer).activateProposal(initial.id));
    projects = await asCreator.listProjects();
    expect(projects[0]!.activeVersion).to.equal(1);

    // Deposit under v1, then amend to remove bob and add carol.
    await confirm(apiFor(payer).deposit(1n, 1, ETH("1")));
    await confirm(
      apiFor(alice).proposeAgreement(1n, [
        { contributor: alice.address, shareBps: 5000 },
        { contributor: carol.address, shareBps: 5000 },
      ]),
    );
    detail = await apiFor(alice).loadProject(1n, alice.address);
    const change = detail.proposals[0]!;
    expect(change.status).to.equal("Pending");
    expect(change.approvers.map((a) => a.account)).to.deep.equal([alice.address, bob.address, carol.address]);
    for (const s of [alice, bob, carol]) await confirm(apiFor(s).approveProposal(change.id));
    await confirm(apiFor(alice).activateProposal(change.id));

    // A deposit naming the old version is rejected; the active one is accepted.
    const stale = await apiFor(payer).deposit(1n, 1, ETH("1")).catch((e: unknown) => e);
    expect(describeTxError(stale, asCreator.interface).message).to.match(/changed to version 2/);
    await confirm(apiFor(payer).deposit(1n, 2, ETH("2")));

    // History is preserved and balances are per wallet.
    const asBob = await apiFor(bob).loadProject(1n, bob.address);
    expect(asBob.versions.map((v) => v.splits.length)).to.deep.equal([2, 2]);
    expect(asBob.versions[0]!.splits.map((s) => s.contributor)).to.deep.equal([alice.address, bob.address]);
    expect(asBob.proposals.map((p) => p.status)).to.deep.equal(["Activated", "Activated"]);
    expect(asBob.deposits.map((d) => [d.version, d.amount])).to.deep.equal([
      [2, ETH("2")],
      [1, ETH("1")],
    ]);
    expect(asBob.revenue.deposited).to.equal(ETH("3"));
    expect(asBob.account!.claimable).to.equal(ETH("0.4")); // removed in v2, keeps v1 earnings
    expect(asBob.account!.earnedByVersion).to.deep.equal([
      { version: 1, amount: ETH("0.4") },
      { version: 2, amount: 0n },
    ]);

    // Claims withdraw only the signing wallet's own balance.
    const before = await ethers.provider.getBalance(bob.address);
    await confirm(apiFor(bob).claimAll(1n));
    expect(await ethers.provider.getBalance(bob.address)).to.be.greaterThan(before);
    const after = await apiFor(bob).loadProject(1n, bob.address);
    expect(after.account!.claimable).to.equal(0n);
    expect(after.revenue.claimed).to.equal(ETH("0.4"));
    const carolView = await apiFor(carol).loadProject(1n, carol.address);
    expect(carolView.account!.claimable).to.equal(ETH("1"));
  });

  it("reports rejections, unauthorised and duplicate votes, and over-claims from contract state", async () => {
    const { creator, alice, bob, outsider, apiFor } = await loadFixture(fixture);
    await confirm(
      apiFor(creator).createProject("Second Shift", 6, [
        { contributor: alice.address, shareBps: 5000 },
        { contributor: bob.address, shareBps: 5000 },
      ]),
    );
    const notRequired = await apiFor(outsider).approveProposal(1n).catch((e: unknown) => e);
    expect(describeTxError(notRequired, apiFor(outsider).interface).message).to.match(/not one of the contributors required/);

    await confirm(apiFor(alice).approveProposal(1n));
    const twice = await apiFor(alice).approveProposal(1n).catch((e: unknown) => e);
    expect(describeTxError(twice, apiFor(alice).interface).message).to.match(/already voted/);

    await confirm(apiFor(bob).rejectProposal(1n));
    const detail = await apiFor(alice).loadProject(1n, alice.address);
    expect(detail.proposals[0]!.status).to.equal("Rejected");
    expect(detail.proposals[0]!.approvers).to.deep.equal([
      { account: alice.address, vote: "Approved" },
      { account: bob.address, vote: "Rejected" },
    ]);
    expect(detail.project.activeVersion).to.equal(0);

    const overClaim = await apiFor(alice).claim(1n, 1n).catch((e: unknown) => e);
    expect(describeTxError(overClaim, apiFor(alice).interface).message).to.match(/at most 0\.0 ETH/);
  });

  it("refuses to send any transaction when the wallet is on the wrong network", async () => {
    const { alice, apiFor } = await loadFixture(fixture);
    const err = await apiFor(alice, false)
      .createProject("X", 0, [{ contributor: alice.address, shareBps: 10000 }])
      .catch((e: unknown) => e);
    expect(err).to.be.instanceOf(WrongNetworkError);
    expect(describeTxError(err).kind).to.equal("wrong-network");
    expect(await apiFor(alice).listProjects()).to.have.length(0);
  });
});
