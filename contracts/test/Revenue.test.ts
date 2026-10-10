import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import type { CollaborationRegistry } from "../typechain-types";

type SplitInput = { contributor: string; shareBps: number };
const split = (who: { address: string } | string, shareBps: number): SplitInput => ({
  contributor: typeof who === "string" ? who : who.address,
  shareBps,
});
const ETH = (n: string) => ethers.parseEther(n);

/** Propose, have every listed approver approve, and activate. Returns the new version. */
async function amend(
  registry: CollaborationRegistry,
  projectId: bigint,
  proposer: HardhatEthersSigner,
  splits: SplitInput[],
  approvers: HardhatEthersSigner[],
) {
  await registry.connect(proposer).proposeAgreement(projectId, splits);
  const id = await registry.proposalCount();
  for (const a of approvers) await registry.connect(a).approveProposal(id);
  await registry.activateProposal(id);
  return (await registry.getProject(projectId)).activeVersion;
}

/** The contract's ETH balance must always equal the sum of everyone's unclaimed earnings. */
async function expectFullyBacked(registry: CollaborationRegistry, projectIds: bigint[], accounts: string[]) {
  let unclaimed = 0n;
  for (const p of projectIds) {
    for (const a of accounts) unclaimed += await registry.claimable(p, a);
    const [deposited, claimed] = await registry.projectRevenue(p);
    let sumEarned = 0n;
    for (const a of accounts) sumEarned += (await registry.balanceOf(p, a)).earned;
    // Every deposited wei is allocated to someone — no more, no less.
    expect(sumEarned, `project ${p} allocations`).to.equal(deposited);
    expect(deposited - claimed).to.be.greaterThanOrEqual(0n);
  }
  expect(await ethers.provider.getBalance(await registry.getAddress())).to.equal(unclaimed);
}

describe("CollaborationRegistry revenue", () => {
  /** Project 1, version 1 active: alice 50%, bob 30%, carol 20%. */
  async function fixture() {
    const [creator, alice, bob, carol, dave, payer, outsider] = await ethers.getSigners();
    const registry = await ethers.deployContract("CollaborationRegistry");
    await registry
      .connect(creator)
      .createProject("Midnight Sessions", 0, [split(alice, 5000), split(bob, 3000), split(carol, 2000)]);
    for (const s of [alice, bob, carol]) await registry.connect(s).approveProposal(1n);
    await registry.activateProposal(1n);
    const everyone = [creator, alice, bob, carol, dave, payer, outsider].map((s) => s.address);
    return { registry, creator, alice, bob, carol, dave, payer, outsider, everyone, projectId: 1n };
  }

  // -------------------------------------------------------------------------
  describe("deposits", () => {
    it("attributes a deposit to the active version and allocates it by that version's shares", async () => {
      const { registry, alice, bob, carol, payer, projectId, everyone } = await loadFixture(fixture);

      await expect(registry.connect(payer).deposit(projectId, 1, { value: ETH("1") }))
        .to.emit(registry, "RevenueDeposited")
        .withArgs(projectId, 1, 1n, payer.address, ETH("1"))
        .and.not.to.emit(registry, "RemainderAllocated");

      const d = await registry.getDeposit(1n);
      expect([d.projectId, d.version, d.depositor, d.amount]).to.deep.equal([projectId, 1n, payer.address, ETH("1")]);
      expect(await registry.versionRevenue(projectId, 1)).to.equal(ETH("1"));
      expect(await registry.claimable(projectId, alice.address)).to.equal(ETH("0.5"));
      expect(await registry.claimable(projectId, bob.address)).to.equal(ETH("0.3"));
      expect(await registry.claimable(projectId, carol.address)).to.equal(ETH("0.2"));
      expect(await registry.earnedInVersion(projectId, 1, bob.address)).to.equal(ETH("0.3"));
      expect(await registry.projectRevenue(projectId)).to.deep.equal([ETH("1"), 0n]);
      await expectFullyBacked(registry, [projectId], everyone);
    });

    it("accumulates multiple deposits from any account", async () => {
      const { registry, alice, payer, outsider, projectId, everyone } = await loadFixture(fixture);
      await registry.connect(payer).deposit(projectId, 1, { value: ETH("1") });
      await registry.connect(outsider).deposit(projectId, 1, { value: ETH("3") });
      expect(await registry.depositCount()).to.equal(2n);
      expect(await registry.versionRevenue(projectId, 1)).to.equal(ETH("4"));
      expect(await registry.claimable(projectId, alice.address)).to.equal(ETH("2"));
      await expectFullyBacked(registry, [projectId], everyone);
    });

    it("rejects zero-value deposits", async () => {
      const { registry, payer, projectId } = await loadFixture(fixture);
      await expect(registry.connect(payer).deposit(projectId, 1, { value: 0 })).to.be.revertedWithCustomError(
        registry,
        "ZeroDeposit",
      );
    });

    it("rejects deposits before any agreement is active", async () => {
      const { registry, creator, alice, payer } = await loadFixture(fixture);
      await registry.connect(creator).createProject("Pending", 1, [split(alice, 10000)]);
      await expect(registry.connect(payer).deposit(2n, 0, { value: ETH("1") }))
        .to.be.revertedWithCustomError(registry, "NoActiveAgreement")
        .withArgs(2n);
    });

    it("rejects deposits for unknown projects", async () => {
      const { registry, payer } = await loadFixture(fixture);
      await expect(registry.connect(payer).deposit(9n, 1, { value: ETH("1") }))
        .to.be.revertedWithCustomError(registry, "ProjectNotFound")
        .withArgs(9n);
    });

    it("rejects a deposit when the active version differs from the one the depositor expected", async () => {
      const { registry, alice, bob, carol, payer, projectId } = await loadFixture(fixture);
      await amend(registry, projectId, alice, [split(alice, 4000), split(bob, 4000), split(carol, 2000)], [alice, bob, carol]);
      await expect(registry.connect(payer).deposit(projectId, 1, { value: ETH("1") }))
        .to.be.revertedWithCustomError(registry, "VersionMismatch")
        .withArgs(1, 2);
    });

    it("attributes deposits to the current version while a change is still pending", async () => {
      const { registry, alice, bob, carol, payer, projectId } = await loadFixture(fixture);
      await registry.connect(alice).proposeAgreement(projectId, [split(alice, 9000), split(bob, 500), split(carol, 500)]);
      await registry.connect(alice).approveProposal(2n);
      await registry.connect(payer).deposit(projectId, 1, { value: ETH("1") });
      expect(await registry.claimable(projectId, alice.address)).to.equal(ETH("0.5"));
      expect(await registry.claimable(projectId, bob.address)).to.equal(ETH("0.3"));
    });

    it("still rejects plain ETH transfers that name no project", async () => {
      const { registry, payer } = await loadFixture(fixture);
      await expect(payer.sendTransaction({ to: await registry.getAddress(), value: 1n })).to.be.reverted;
    });
  });

  // -------------------------------------------------------------------------
  describe("multiple agreement versions", () => {
    it("uses each version's own shares for deposits made while it was active", async () => {
      const { registry, alice, bob, carol, payer, projectId, everyone } = await loadFixture(fixture);
      await registry.connect(payer).deposit(projectId, 1, { value: ETH("1") });
      const v2 = await amend(registry, projectId, bob, [split(alice, 2000), split(bob, 6000), split(carol, 2000)], [
        alice,
        bob,
        carol,
      ]);
      await expect(registry.connect(payer).deposit(projectId, v2, { value: ETH("2") }))
        .to.emit(registry, "RevenueDeposited")
        .withArgs(projectId, 2, 2n, payer.address, ETH("2"));

      expect(await registry.earnedInVersion(projectId, 1, bob.address)).to.equal(ETH("0.3"));
      expect(await registry.earnedInVersion(projectId, 2, bob.address)).to.equal(ETH("1.2"));
      expect(await registry.claimable(projectId, bob.address)).to.equal(ETH("1.5"));
      expect(await registry.claimable(projectId, alice.address)).to.equal(ETH("0.9"));
      expect(await registry.versionRevenue(projectId, 1)).to.equal(ETH("1"));
      expect(await registry.versionRevenue(projectId, 2)).to.equal(ETH("2"));
      // Earlier deposits are not re-attributed by later versions.
      expect((await registry.getDeposit(1n)).version).to.equal(1n);
      await expectFullyBacked(registry, [projectId], everyone);
    });

    it("reverts version-level reads for versions that do not exist", async () => {
      const { registry, alice, projectId } = await loadFixture(fixture);
      await expect(registry.versionRevenue(projectId, 2)).to.be.revertedWithCustomError(registry, "VersionNotFound");
      await expect(registry.earnedInVersion(projectId, 0, alice.address)).to.be.revertedWithCustomError(
        registry,
        "VersionNotFound",
      );
      await expect(registry.getDeposit(1n)).to.be.revertedWithCustomError(registry, "DepositNotFound");
    });

    it("keeps different projects' revenue separate", async () => {
      const { registry, creator, alice, bob, payer, projectId, everyone } = await loadFixture(fixture);
      await registry.connect(creator).createProject("Second", 6, [split(alice, 5000), split(bob, 5000)]);
      await registry.connect(alice).approveProposal(2n);
      await registry.connect(bob).approveProposal(2n);
      await registry.activateProposal(2n);

      await registry.connect(payer).deposit(projectId, 1, { value: ETH("1") });
      await registry.connect(payer).deposit(2n, 1, { value: ETH("4") });
      expect(await registry.claimable(projectId, bob.address)).to.equal(ETH("0.3"));
      expect(await registry.claimable(2n, bob.address)).to.equal(ETH("2"));

      await registry.connect(bob).claimAll(projectId);
      await expect(registry.connect(bob).claim(projectId, 1n)).to.be.revertedWithCustomError(registry, "InsufficientBalance");
      expect(await registry.claimable(2n, bob.address)).to.equal(ETH("2"));
      await expectFullyBacked(registry, [projectId, 2n], everyone);
    });
  });

  // -------------------------------------------------------------------------
  describe("claims", () => {
    async function funded() {
      const f = await fixture();
      await f.registry.connect(f.payer).deposit(f.projectId, 1, { value: ETH("1") });
      return f;
    }

    it("pays a contributor exactly their unclaimed balance", async () => {
      const { registry, bob, projectId, everyone } = await loadFixture(funded);
      const tx = registry.connect(bob).claimAll(projectId);
      await expect(tx).to.emit(registry, "RevenueClaimed").withArgs(projectId, bob.address, ETH("0.3"));
      await expect(tx).to.changeEtherBalances([bob, registry], [ETH("0.3"), -ETH("0.3")]);
      expect(await registry.claimable(projectId, bob.address)).to.equal(0n);
      expect(await registry.balanceOf(projectId, bob.address)).to.deep.equal([ETH("0.3"), ETH("0.3")]);
      expect(await registry.projectRevenue(projectId)).to.deep.equal([ETH("1"), ETH("0.3")]);
      await expectFullyBacked(registry, [projectId], everyone);
    });

    it("supports partial claims followed by claiming the rest", async () => {
      const { registry, alice, projectId, everyone } = await loadFixture(funded);
      await expect(registry.connect(alice).claim(projectId, ETH("0.2"))).to.changeEtherBalance(alice, ETH("0.2"));
      expect(await registry.claimable(projectId, alice.address)).to.equal(ETH("0.3"));
      await expect(registry.connect(alice).claimAll(projectId)).to.changeEtherBalance(alice, ETH("0.3"));
      await expectFullyBacked(registry, [projectId], everyone);
    });

    it("prevents repeated claims", async () => {
      const { registry, carol, projectId } = await loadFixture(funded);
      await registry.connect(carol).claimAll(projectId);
      await expect(registry.connect(carol).claimAll(projectId)).to.be.revertedWithCustomError(registry, "NothingToClaim");
      await expect(registry.connect(carol).claim(projectId, 1n))
        .to.be.revertedWithCustomError(registry, "InsufficientBalance")
        .withArgs(0n, 1n);
    });

    it("rejects claims above the available balance", async () => {
      const { registry, carol, projectId } = await loadFixture(funded);
      await expect(registry.connect(carol).claim(projectId, ETH("0.2") + 1n))
        .to.be.revertedWithCustomError(registry, "InsufficientBalance")
        .withArgs(ETH("0.2"), ETH("0.2") + 1n);
      expect(await registry.claimable(projectId, carol.address)).to.equal(ETH("0.2"));
    });

    it("rejects zero-amount claims", async () => {
      const { registry, alice, projectId } = await loadFixture(funded);
      await expect(registry.connect(alice).claim(projectId, 0)).to.be.revertedWithCustomError(registry, "ZeroClaim");
    });

    it("never lets an account claim someone else's earnings", async () => {
      const { registry, alice, bob, outsider, payer, creator, projectId } = await loadFixture(funded);
      for (const signer of [outsider, payer, creator]) {
        await expect(registry.connect(signer).claimAll(projectId)).to.be.revertedWithCustomError(registry, "NothingToClaim");
        await expect(registry.connect(signer).claim(projectId, ETH("0.3")))
          .to.be.revertedWithCustomError(registry, "InsufficientBalance")
          .withArgs(0n, ETH("0.3"));
      }
      // Alice's claim pays Alice only and leaves Bob's balance intact.
      await expect(registry.connect(alice).claimAll(projectId)).to.changeEtherBalances([alice, bob], [ETH("0.5"), 0n]);
      expect(await registry.claimable(projectId, bob.address)).to.equal(ETH("0.3"));
    });

    it("rejects claims for unknown projects", async () => {
      const { registry, alice } = await loadFixture(funded);
      await expect(registry.connect(alice).claimAll(5n)).to.be.revertedWithCustomError(registry, "ProjectNotFound");
    });
  });

  // -------------------------------------------------------------------------
  describe("contributor removal", () => {
    it("keeps a removed contributor's earned balance claimable but gives them nothing from later versions", async () => {
      const { registry, alice, bob, carol, payer, projectId, everyone } = await loadFixture(fixture);
      await registry.connect(payer).deposit(projectId, 1, { value: ETH("1") });

      const v2 = await amend(registry, projectId, alice, [split(alice, 6000), split(bob, 4000)], [alice, bob, carol]);
      expect(await registry.isActiveContributor(projectId, carol.address)).to.equal(false);
      expect(await registry.claimable(projectId, carol.address)).to.equal(ETH("0.2"));

      await registry.connect(payer).deposit(projectId, v2, { value: ETH("5") });
      expect(await registry.earnedInVersion(projectId, v2, carol.address)).to.equal(0n);
      expect(await registry.claimable(projectId, carol.address)).to.equal(ETH("0.2"));
      expect(await registry.claimable(projectId, alice.address)).to.equal(ETH("3.5"));
      expect(await registry.claimable(projectId, bob.address)).to.equal(ETH("2.3"));

      await expect(registry.connect(carol).claimAll(projectId)).to.changeEtherBalance(carol, ETH("0.2"));
      await expect(registry.connect(carol).claimAll(projectId)).to.be.revertedWithCustomError(registry, "NothingToClaim");
      await expectFullyBacked(registry, [projectId], everyone);
    });

    it("does not give newly added contributors revenue from before they joined", async () => {
      const { registry, alice, bob, carol, dave, payer, projectId } = await loadFixture(fixture);
      await registry.connect(payer).deposit(projectId, 1, { value: ETH("1") });
      const v2 = await amend(
        registry,
        projectId,
        alice,
        [split(alice, 4000), split(bob, 3000), split(carol, 2000), split(dave, 1000)],
        [alice, bob, carol, dave],
      );
      expect(await registry.claimable(projectId, dave.address)).to.equal(0n);
      await registry.connect(payer).deposit(projectId, v2, { value: ETH("1") });
      expect(await registry.claimable(projectId, dave.address)).to.equal(ETH("0.1"));
    });
  });

  // -------------------------------------------------------------------------
  describe("rounding", () => {
    it("allocates a 1-wei deposit entirely to the largest share via the explicit remainder", async () => {
      const { registry, alice, bob, carol, payer, projectId, everyone } = await loadFixture(fixture);
      await expect(registry.connect(payer).deposit(projectId, 1, { value: 1n }))
        .to.emit(registry, "RemainderAllocated")
        .withArgs(projectId, 1n, alice.address, 1n);
      expect(await registry.claimable(projectId, alice.address)).to.equal(1n);
      expect(await registry.claimable(projectId, bob.address)).to.equal(0n);
      expect(await registry.claimable(projectId, carol.address)).to.equal(0n);
      await expectFullyBacked(registry, [projectId], everyone);
    });

    it("splits 10 wei over 33.33/33.34/33.33% as 3/4/3 with the remainder to the largest share", async () => {
      const f = await loadFixture(fixture);
      const { registry, creator, alice, bob, carol, payer, everyone } = f;
      await registry.connect(creator).createProject("Thirds", 6, [split(alice, 3333), split(bob, 3334), split(carol, 3333)]);
      for (const s of [alice, bob, carol]) await registry.connect(s).approveProposal(2n);
      await registry.activateProposal(2n);

      await expect(registry.connect(payer).deposit(2n, 1, { value: 10n }))
        .to.emit(registry, "RemainderAllocated")
        .withArgs(2n, 1n, bob.address, 1n);
      expect(await registry.claimable(2n, alice.address)).to.equal(3n);
      expect(await registry.claimable(2n, bob.address)).to.equal(4n);
      expect(await registry.claimable(2n, carol.address)).to.equal(3n);
      await expectFullyBacked(registry, [1n, 2n], everyone);
    });

    it("breaks ties for the remainder in favour of the first-listed contributor", async () => {
      const { registry, creator, alice, bob, payer } = await loadFixture(fixture);
      await registry.connect(creator).createProject("Tie", 6, [split(bob, 5000), split(alice, 5000)]);
      await registry.connect(alice).approveProposal(2n);
      await registry.connect(bob).approveProposal(2n);
      await registry.activateProposal(2n);
      await expect(registry.connect(payer).deposit(2n, 1, { value: 3n }))
        .to.emit(registry, "RemainderAllocated")
        .withArgs(2n, 1n, bob.address, 1n);
      expect(await registry.claimable(2n, bob.address)).to.equal(2n);
      expect(await registry.claimable(2n, alice.address)).to.equal(1n);
    });

    it("stays fully backed across many awkward deposits, claims and a version change", async () => {
      const { registry, alice, bob, carol, dave, payer, projectId, everyone } = await loadFixture(fixture);
      const amounts = [1n, 7n, 13n, 99n, 1001n, ETH("0.333333333333333333"), 123456789n];
      for (const value of amounts) await registry.connect(payer).deposit(projectId, 1, { value });
      await registry.connect(bob).claimAll(projectId);
      const v2 = await amend(registry, projectId, alice, [split(alice, 3333), split(dave, 6667)], [alice, bob, carol, dave]);
      for (const value of amounts) await registry.connect(payer).deposit(projectId, v2, { value });
      await registry.connect(carol).claimAll(projectId);
      await registry.connect(dave).claim(projectId, 5n);

      const total = amounts.reduce((a, b) => a + b, 0n) * 2n;
      expect((await registry.projectRevenue(projectId))[0]).to.equal(total);
      await expectFullyBacked(registry, [projectId], everyone);

      // Everyone can withdraw everything; the contract ends with exactly zero.
      for (const s of [alice, bob, carol, dave]) {
        if ((await registry.claimable(projectId, s.address)) > 0n) await registry.connect(s).claimAll(projectId);
      }
      expect(await ethers.provider.getBalance(await registry.getAddress())).to.equal(0n);
    });

    it("handles the maximum of 50 contributors within a reasonable gas budget", async () => {
      const { registry, creator, payer } = await loadFixture(fixture);
      const wallets = Array.from({ length: 50 }, () => ethers.Wallet.createRandom().connect(ethers.provider));
      for (const w of wallets) await payer.sendTransaction({ to: w.address, value: ETH("1") });
      await registry.connect(creator).createProject("Fifty", 4, wallets.map((w) => split(w.address, 200)));
      for (const w of wallets) await registry.connect(w).approveProposal(2n);
      await registry.activateProposal(2n);

      const tx = await registry.connect(payer).deposit(2n, 1, { value: 1_000_049n });
      const receipt = await tx.wait();
      expect(receipt!.gasUsed).to.be.lessThan(3_000_000n);

      let sum = 0n;
      for (const w of wallets) sum += await registry.claimable(2n, w.address);
      expect(sum).to.equal(1_000_049n);
      expect(await registry.claimable(2n, wallets[0]!.address)).to.equal(20_000n + 49n);
    });
  });

  // -------------------------------------------------------------------------
  describe("reentrancy and failed transfers", () => {
    it("blocks a contributor contract from re-entering claimAll to double-claim", async () => {
      const { registry, creator, alice, payer } = await loadFixture(fixture);
      const attacker = await ethers.deployContract("ReentrantClaimer", [await registry.getAddress()]);
      const attackerAddr = await attacker.getAddress();
      await registry.connect(creator).createProject("Target", 2, [split(attackerAddr, 5000), split(alice, 5000)]);
      await attacker.approve(2n);
      await registry.connect(alice).approveProposal(2n);
      await registry.activateProposal(2n);
      await registry.connect(payer).deposit(2n, 1, { value: ETH("2") });

      await expect(attacker.attack(2n)).to.changeEtherBalances([attacker, registry], [ETH("1"), -ETH("1")]);
      expect(await attacker.reentryAttempts()).to.equal(1n);
      expect(await attacker.reentryBlocked()).to.equal(true);
      expect(await registry.claimable(2n, attackerAddr)).to.equal(0n);
      expect(await registry.claimable(2n, alice.address)).to.equal(ETH("1"));
      expect(await ethers.provider.getBalance(await registry.getAddress())).to.equal(ETH("1"));
    });

    it("reverts the whole claim if the recipient cannot accept ETH, leaving the balance claimable", async () => {
      const { registry, creator, alice, payer } = await loadFixture(fixture);
      const rejecter = await ethers.deployContract("RejectingReceiver", [await registry.getAddress()]);
      const addr = await rejecter.getAddress();
      await registry.connect(creator).createProject("Rejects", 2, [split(addr, 5000), split(alice, 5000)]);
      await rejecter.approve(2n);
      await registry.connect(alice).approveProposal(2n);
      await registry.activateProposal(2n);
      await registry.connect(payer).deposit(2n, 1, { value: ETH("1") });

      await expect(rejecter.claimAll(2n)).to.be.revertedWithCustomError(registry, "TransferFailed");
      expect(await registry.claimable(2n, addr)).to.equal(ETH("0.5"));
      expect(await registry.projectRevenue(2n)).to.deep.equal([ETH("1"), 0n]);
      expect(await ethers.provider.getBalance(await registry.getAddress())).to.equal(ETH("1"));
    });
  });
});
