import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import type { CollaborationRegistry } from "../typechain-types";

const ContentType = { Music: 0, Film: 1, Documentary: 2, Docuseries: 3, LongFormVideo: 4, ShortFormVideo: 5, Podcast: 6 };
const Status = { Pending: 0n, Activated: 1n, Rejected: 2n, Cancelled: 3n, Superseded: 4n };
const Vote = { None: 0n, Approved: 1n, Rejected: 2n };

type SplitInput = { contributor: string; shareBps: number };
const split = (who: { address: string } | string, shareBps: number): SplitInput => ({
  contributor: typeof who === "string" ? who : who.address,
  shareBps,
});

/** Normalise a returned Split[] into comparable [address, bps] tuples. */
const tuples = (splits: readonly { contributor: string; shareBps: bigint }[]) =>
  splits.map((s) => [s.contributor, Number(s.shareBps)]);

async function propose(registry: CollaborationRegistry, signer: HardhatEthersSigner, projectId: bigint, splits: SplitInput[]) {
  await registry.connect(signer).proposeAgreement(projectId, splits);
  return registry.proposalCount();
}

async function approveAll(registry: CollaborationRegistry, proposalId: bigint, signers: HardhatEthersSigner[]) {
  for (const s of signers) await registry.connect(s).approveProposal(proposalId);
}

describe("CollaborationRegistry", () => {
  async function deployFixture() {
    const [creator, alice, bob, carol, dave, outsider] = await ethers.getSigners();
    const registry = await ethers.deployContract("CollaborationRegistry");
    return { registry, creator, alice, bob, carol, dave, outsider };
  }

  /** Project 1 with an active version 1: alice 50%, bob 30%, carol 20%. */
  async function activeProjectFixture() {
    const base = await deployFixture();
    const { registry, creator, alice, bob, carol } = base;
    await registry
      .connect(creator)
      .createProject("Midnight Sessions", ContentType.Music, [split(alice, 5000), split(bob, 3000), split(carol, 2000)]);
    await approveAll(registry, 1n, [alice, bob, carol]);
    await registry.activateProposal(1n);
    return { ...base, projectId: 1n };
  }

  // -------------------------------------------------------------------------
  describe("project creation and the initial agreement", () => {
    it("creates a project with a pending initial proposal and no active agreement", async () => {
      const { registry, creator, alice, bob } = await loadFixture(deployFixture);
      const splits = [split(alice, 6000), split(bob, 4000)];

      await expect(registry.connect(creator).createProject("Tides", ContentType.Documentary, splits))
        .to.emit(registry, "ProjectCreated")
        .withArgs(1n, creator.address, ContentType.Documentary, "Tides")
        .and.to.emit(registry, "ProposalCreated")
        .withArgs(1n, 1n, creator.address, 0, 2);

      const project = await registry.getProject(1n);
      expect(project.creator).to.equal(creator.address);
      expect(project.activeVersion).to.equal(0n);
      await expect(registry.getActiveAgreement(1n)).to.be.revertedWithCustomError(registry, "VersionNotFound");
      expect(await registry.isActiveContributor(1n, alice.address)).to.equal(false);

      const proposal = await registry.getProposal(1n);
      expect(proposal.status).to.equal(Status.Pending);
      expect(proposal.baseVersion).to.equal(0n);
      expect(proposal.requiredCount).to.equal(2n);
      expect(await registry.getRequiredApprovers(1n)).to.deep.equal([alice.address, bob.address]);
      expect(tuples(await registry.getProposedSplits(1n))).to.deep.equal([
        [alice.address, 6000],
        [bob.address, 4000],
      ]);
    });

    it("activates version 1 only after every listed contributor approves", async () => {
      const { registry, creator, alice, bob, outsider } = await loadFixture(deployFixture);
      await registry.connect(creator).createProject("Tides", ContentType.Documentary, [split(alice, 6000), split(bob, 4000)]);

      await expect(registry.activateProposal(1n)).to.be.revertedWithCustomError(registry, "MissingApprovals").withArgs(0, 2);

      await expect(registry.connect(alice).approveProposal(1n))
        .to.emit(registry, "ProposalApproved")
        .withArgs(1n, 1n, alice.address, 1, 2);
      await expect(registry.activateProposal(1n)).to.be.revertedWithCustomError(registry, "MissingApprovals").withArgs(1, 2);

      await registry.connect(bob).approveProposal(1n);
      // Activation is permissionless: all conditions are enforced on-chain.
      await expect(registry.connect(outsider).activateProposal(1n))
        .to.emit(registry, "AgreementActivated")
        .withArgs(1n, 1, 1n);

      const [version, info, splits] = await registry.getActiveAgreement(1n);
      expect(version).to.equal(1n);
      expect(info.proposalId).to.equal(1n);
      expect(tuples(splits)).to.deep.equal([
        [alice.address, 6000],
        [bob.address, 4000],
      ]);
      expect((await registry.getProposal(1n)).status).to.equal(Status.Activated);
      expect(await registry.isActiveContributor(1n, alice.address)).to.equal(true);
    });

    it("does not let a non-contributor creator approve on contributors' behalf", async () => {
      const { registry, creator, alice, bob } = await loadFixture(deployFixture);
      await registry.connect(creator).createProject("Tides", ContentType.Film, [split(alice, 6000), split(bob, 4000)]);
      await expect(registry.connect(creator).approveProposal(1n))
        .to.be.revertedWithCustomError(registry, "NotRequiredApprover")
        .withArgs(creator.address);
    });

    it("leaves the project without an agreement when the initial proposal is rejected; only the creator may re-propose", async () => {
      const { registry, creator, alice, bob } = await loadFixture(deployFixture);
      await registry.connect(creator).createProject("Tides", ContentType.Film, [split(alice, 6000), split(bob, 4000)]);
      await registry.connect(alice).approveProposal(1n);
      await expect(registry.connect(bob).rejectProposal(1n))
        .to.emit(registry, "ProposalRejected")
        .withArgs(1n, 1n, bob.address);

      expect((await registry.getProject(1n)).activeVersion).to.equal(0n);
      await expect(registry.activateProposal(1n))
        .to.be.revertedWithCustomError(registry, "ProposalNotPending")
        .withArgs(1n, Status.Rejected);

      await expect(registry.connect(alice).proposeAgreement(1n, [split(alice, 5000), split(bob, 5000)]))
        .to.be.revertedWithCustomError(registry, "NotAuthorizedProposer")
        .withArgs(alice.address);

      const second = await propose(registry, creator, 1n, [split(alice, 5000), split(bob, 5000)]);
      expect((await registry.getProposal(second)).baseVersion).to.equal(0n);
      await approveAll(registry, second, [alice, bob]);
      await registry.activateProposal(second);
      expect((await registry.getProject(1n)).activeVersion).to.equal(1n);
    });

    it("rejects an empty title", async () => {
      const { registry, alice } = await loadFixture(deployFixture);
      await expect(
        registry.createProject("", ContentType.Music, [split(alice, 10000)]),
      ).to.be.revertedWithCustomError(registry, "EmptyTitle");
    });
  });

  // -------------------------------------------------------------------------
  describe("share validation", () => {
    // Every rule is checked both for new projects and for amendment proposals.
    async function expectInvalid(splits: SplitInput[], error: string, args?: unknown[]) {
      const { registry, alice, projectId } = await loadFixture(activeProjectFixture);
      for (const send of [
        () => registry.createProject("New", ContentType.Podcast, splits),
        () => registry.connect(alice).proposeAgreement(projectId, splits),
      ]) {
        const assertion = expect(send()).to.be.revertedWithCustomError(registry, error);
        await (args ? assertion.withArgs(...args) : assertion);
      }
    }

    it("rejects shares totalling less than 100%", async () => {
      const [, a, b] = await ethers.getSigners();
      await expectInvalid([split(a, 5000), split(b, 4999)], "SharesMustTotal100Percent", [9999n]);
    });

    it("rejects shares totalling more than 100%", async () => {
      const [, a, b] = await ethers.getSigners();
      await expectInvalid([split(a, 5000), split(b, 5001)], "SharesMustTotal100Percent", [10001n]);
    });

    it("rejects duplicate contributors", async () => {
      const [, a] = await ethers.getSigners();
      await expectInvalid([split(a, 5000), split(a, 5000)], "DuplicateContributor", [a.address]);
    });

    it("rejects the zero address", async () => {
      const [, a] = await ethers.getSigners();
      await expectInvalid([split(a, 5000), split(ethers.ZeroAddress, 5000)], "ZeroAddressContributor");
    });

    it("rejects a zero share", async () => {
      const [, a, b] = await ethers.getSigners();
      await expectInvalid([split(a, 10000), split(b, 0)], "ZeroShare", [b.address]);
    });

    it("rejects an empty contributor list", async () => {
      await expectInvalid([], "NoContributors");
    });

    it("rejects more than MAX_CONTRIBUTORS", async () => {
      const many = Array.from({ length: 51 }, (_, i) => split(ethers.toBeHex(i + 1, 20), i === 0 ? 5000 : 100));
      await expectInvalid(many, "TooManyContributors");
    });

    it("accepts exactly MAX_CONTRIBUTORS", async () => {
      const { registry } = await loadFixture(deployFixture);
      const fifty = Array.from({ length: 50 }, (_, i) => split(ethers.toBeHex(i + 1, 20), 200));
      await expect(registry.createProject("Big", ContentType.Film, fifty)).to.emit(registry, "ProposalCreated");
    });

    it("rejects a proposal identical to the current agreement, in any order", async () => {
      const { registry, alice, bob, carol, projectId } = await loadFixture(activeProjectFixture);
      await expect(
        registry.connect(alice).proposeAgreement(projectId, [split(carol, 2000), split(alice, 5000), split(bob, 3000)]),
      ).to.be.revertedWithCustomError(registry, "NoChange");
    });
  });

  // -------------------------------------------------------------------------
  describe("approvals and rejections", () => {
    async function pendingShareChange() {
      const f = await activeProjectFixture();
      const id = await propose(f.registry, f.alice, f.projectId, [split(f.alice, 4000), split(f.bob, 4000), split(f.carol, 2000)]);
      return { ...f, id };
    }

    it("records each approval against the signing wallet", async () => {
      const { registry, alice, bob, carol, id } = await loadFixture(pendingShareChange);
      await registry.connect(bob).approveProposal(id);
      expect(await registry.voteOf(id, bob.address)).to.equal(Vote.Approved);
      expect(await registry.voteOf(id, alice.address)).to.equal(Vote.None);
      expect(await registry.voteOf(id, carol.address)).to.equal(Vote.None);
      expect((await registry.getProposal(id)).approvalCount).to.equal(1n);
    });

    it("does not treat proposing as approving", async () => {
      const { registry, alice, id } = await loadFixture(pendingShareChange);
      expect(await registry.voteOf(id, alice.address)).to.equal(Vote.None);
      expect((await registry.getProposal(id)).approvalCount).to.equal(0n);
    });

    it("rejects approvals and rejections from wallets that are not required approvers", async () => {
      const { registry, outsider, creator, id } = await loadFixture(pendingShareChange);
      await expect(registry.connect(outsider).approveProposal(id))
        .to.be.revertedWithCustomError(registry, "NotRequiredApprover")
        .withArgs(outsider.address);
      await expect(registry.connect(outsider).rejectProposal(id))
        .to.be.revertedWithCustomError(registry, "NotRequiredApprover")
        .withArgs(outsider.address);
      // The project creator has no special voting power once they are not a contributor.
      await expect(registry.connect(creator).approveProposal(id)).to.be.revertedWithCustomError(
        registry,
        "NotRequiredApprover",
      );
    });

    it("rejects duplicate approvals", async () => {
      const { registry, bob, id } = await loadFixture(pendingShareChange);
      await registry.connect(bob).approveProposal(id);
      await expect(registry.connect(bob).approveProposal(id))
        .to.be.revertedWithCustomError(registry, "AlreadyVoted")
        .withArgs(bob.address);
      expect((await registry.getProposal(id)).approvalCount).to.equal(1n);
    });

    it("does not allow changing a vote from approve to reject", async () => {
      const { registry, bob, id } = await loadFixture(pendingShareChange);
      await registry.connect(bob).approveProposal(id);
      await expect(registry.connect(bob).rejectProposal(id)).to.be.revertedWithCustomError(registry, "AlreadyVoted");
    });

    it("does not activate while any approval is missing", async () => {
      const { registry, alice, bob, projectId, id } = await loadFixture(pendingShareChange);
      await approveAll(registry, id, [alice, bob]);
      await expect(registry.activateProposal(id)).to.be.revertedWithCustomError(registry, "MissingApprovals").withArgs(2, 3);
      expect((await registry.getProject(projectId)).activeVersion).to.equal(1n);
    });

    it("permanently rejects a proposal when one required contributor rejects, even after others approved", async () => {
      const { registry, alice, bob, carol, projectId, id } = await loadFixture(pendingShareChange);
      await approveAll(registry, id, [alice, bob]);
      await expect(registry.connect(carol).rejectProposal(id))
        .to.emit(registry, "ProposalRejected")
        .withArgs(projectId, id, carol.address);

      expect(await registry.voteOf(id, carol.address)).to.equal(Vote.Rejected);
      expect((await registry.getProposal(id)).status).to.equal(Status.Rejected);
      for (const call of [() => registry.activateProposal(id), () => registry.connect(carol).approveProposal(id)]) {
        await expect(call()).to.be.revertedWithCustomError(registry, "ProposalNotPending").withArgs(id, Status.Rejected);
      }

      // The current agreement is untouched.
      const [version, , splits] = await registry.getActiveAgreement(projectId);
      expect(version).to.equal(1n);
      expect(tuples(splits)).to.deep.equal([
        [alice.address, 5000],
        [bob.address, 3000],
        [carol.address, 2000],
      ]);
    });

    it("keeps the current agreement in force while a proposal is pending", async () => {
      const { registry, alice, bob, projectId, id } = await loadFixture(pendingShareChange);
      await approveAll(registry, id, [alice, bob]);
      const [version, , splits] = await registry.getActiveAgreement(projectId);
      expect(version).to.equal(1n);
      expect(Number(splits[0]!.shareBps)).to.equal(5000);
    });

    it("reverts for unknown proposals", async () => {
      const { registry, alice } = await loadFixture(activeProjectFixture);
      for (const call of [
        () => registry.connect(alice).approveProposal(99n),
        () => registry.connect(alice).rejectProposal(99n),
        () => registry.activateProposal(99n),
        () => registry.getProposal(0n),
      ]) {
        await expect(call()).to.be.revertedWithCustomError(registry, "ProposalNotFound");
      }
    });
  });

  // -------------------------------------------------------------------------
  describe("amendments", () => {
    it("changes shares once all current contributors approve", async () => {
      const { registry, alice, bob, carol, projectId } = await loadFixture(activeProjectFixture);
      const id = await propose(registry, bob, projectId, [split(alice, 4000), split(bob, 4000), split(carol, 2000)]);
      expect((await registry.getProposal(id)).baseVersion).to.equal(1n);
      expect(await registry.getRequiredApprovers(id)).to.deep.equal([alice.address, bob.address, carol.address]);

      await approveAll(registry, id, [alice, bob, carol]);
      await expect(registry.activateProposal(id)).to.emit(registry, "AgreementActivated").withArgs(projectId, 2, id);
      expect(await registry.shareInVersion(projectId, 2, alice.address)).to.equal(4000n);
      expect(await registry.shareInVersion(projectId, 1, alice.address)).to.equal(5000n);
    });

    it("requires the newly added contributor's approval as well as every current contributor's", async () => {
      const { registry, alice, bob, carol, dave, projectId } = await loadFixture(activeProjectFixture);
      const id = await propose(registry, alice, projectId, [
        split(alice, 4000),
        split(bob, 3000),
        split(carol, 2000),
        split(dave, 1000),
      ]);
      expect(await registry.getRequiredApprovers(id)).to.deep.equal([
        alice.address,
        bob.address,
        carol.address,
        dave.address,
      ]);

      await approveAll(registry, id, [alice, bob, carol]);
      await expect(registry.activateProposal(id)).to.be.revertedWithCustomError(registry, "MissingApprovals").withArgs(3, 4);

      await registry.connect(dave).approveProposal(id);
      await registry.activateProposal(id);
      expect(await registry.isActiveContributor(projectId, dave.address)).to.equal(true);
      expect(tuples((await registry.getActiveAgreement(projectId))[2])).to.have.length(4);
    });

    it("requires the removed contributor's approval, then excludes them from the new version only", async () => {
      const { registry, alice, bob, carol, projectId } = await loadFixture(activeProjectFixture);
      const id = await propose(registry, alice, projectId, [split(alice, 6000), split(bob, 4000)]);
      expect(await registry.getRequiredApprovers(id)).to.include(carol.address);

      await approveAll(registry, id, [alice, bob]);
      await expect(registry.activateProposal(id)).to.be.revertedWithCustomError(registry, "MissingApprovals");

      await registry.connect(carol).approveProposal(id);
      await registry.activateProposal(id);

      expect(await registry.isActiveContributor(projectId, carol.address)).to.equal(false);
      expect(await registry.shareInVersion(projectId, 2, carol.address)).to.equal(0n);
      // Version 1 still records carol's 20%, so earlier entitlements stay attributable.
      expect(await registry.shareInVersion(projectId, 1, carol.address)).to.equal(2000n);
    });

    it("lets the removed contributor block their own removal", async () => {
      const { registry, alice, bob, carol, projectId } = await loadFixture(activeProjectFixture);
      const id = await propose(registry, alice, projectId, [split(alice, 6000), split(bob, 4000)]);
      await approveAll(registry, id, [alice, bob]);
      await registry.connect(carol).rejectProposal(id);
      expect(await registry.isActiveContributor(projectId, carol.address)).to.equal(true);
    });

    it("supports adding and removing contributors in one proposal", async () => {
      const { registry, alice, bob, carol, dave, projectId } = await loadFixture(activeProjectFixture);
      const id = await propose(registry, carol, projectId, [split(alice, 5000), split(dave, 3000), split(carol, 2000)]);
      expect(await registry.getRequiredApprovers(id)).to.deep.equal([
        alice.address,
        bob.address,
        carol.address,
        dave.address,
      ]);
      await approveAll(registry, id, [alice, bob, carol, dave]);
      await registry.activateProposal(id);
      expect(await registry.isActiveContributor(projectId, bob.address)).to.equal(false);
      expect(await registry.isActiveContributor(projectId, dave.address)).to.equal(true);
    });
  });

  // -------------------------------------------------------------------------
  describe("proposal authorization", () => {
    it("only lets active contributors propose amendments", async () => {
      const { registry, creator, dave, outsider, projectId, alice, bob, carol } = await loadFixture(activeProjectFixture);
      const splits = [split(alice, 4000), split(bob, 4000), split(carol, 2000)];
      for (const signer of [outsider, dave, creator]) {
        await expect(registry.connect(signer).proposeAgreement(projectId, splits))
          .to.be.revertedWithCustomError(registry, "NotAuthorizedProposer")
          .withArgs(signer.address);
      }
    });

    it("revokes proposal rights from removed contributors and grants them to added ones", async () => {
      const { registry, alice, bob, carol, dave, projectId } = await loadFixture(activeProjectFixture);
      const id = await propose(registry, alice, projectId, [split(alice, 5000), split(bob, 3000), split(dave, 2000)]);
      await approveAll(registry, id, [alice, bob, carol, dave]);
      await registry.activateProposal(id);

      const next = [split(alice, 4000), split(bob, 4000), split(dave, 2000)];
      await expect(registry.connect(carol).proposeAgreement(projectId, next)).to.be.revertedWithCustomError(
        registry,
        "NotAuthorizedProposer",
      );
      await expect(registry.connect(dave).proposeAgreement(projectId, next)).to.emit(registry, "ProposalCreated");
    });

    it("reverts for unknown projects", async () => {
      const { registry, alice } = await loadFixture(activeProjectFixture);
      await expect(registry.connect(alice).proposeAgreement(2n, [split(alice, 10000)]))
        .to.be.revertedWithCustomError(registry, "ProjectNotFound")
        .withArgs(2n);
    });
  });

  // -------------------------------------------------------------------------
  describe("competing and cancelled proposals", () => {
    it("supersedes other pending proposals when one activates", async () => {
      const { registry, alice, bob, carol, projectId } = await loadFixture(activeProjectFixture);
      const first = await propose(registry, alice, projectId, [split(alice, 4000), split(bob, 4000), split(carol, 2000)]);
      const second = await propose(registry, bob, projectId, [split(alice, 5000), split(bob, 2500), split(carol, 2500)]);

      await registry.connect(alice).approveProposal(second);
      await approveAll(registry, first, [alice, bob, carol]);
      await registry.activateProposal(first);

      expect((await registry.getProposal(second)).status).to.equal(Status.Superseded);
      for (const call of [
        () => registry.connect(bob).approveProposal(second),
        () => registry.connect(carol).rejectProposal(second),
        () => registry.activateProposal(second),
      ]) {
        await expect(call()).to.be.revertedWithCustomError(registry, "ProposalSuperseded").withArgs(second);
      }
      expect((await registry.getProject(projectId)).activeVersion).to.equal(2n);
      // Version 2 is the first proposal's split and was not overwritten by the stale one.
      const [info, splits] = await registry.getAgreement(projectId, 2);
      expect(info.proposalId).to.equal(first);
      expect(tuples(splits)).to.deep.equal([
        [alice.address, 4000],
        [bob.address, 4000],
        [carol.address, 2000],
      ]);
    });

    it("lets only the proposer cancel, and a cancelled proposal can never activate", async () => {
      const { registry, alice, bob, carol, projectId } = await loadFixture(activeProjectFixture);
      const id = await propose(registry, alice, projectId, [split(alice, 4000), split(bob, 4000), split(carol, 2000)]);
      await approveAll(registry, id, [alice, bob, carol]);

      await expect(registry.connect(bob).cancelProposal(id))
        .to.be.revertedWithCustomError(registry, "NotProposer")
        .withArgs(bob.address);
      await expect(registry.connect(alice).cancelProposal(id))
        .to.emit(registry, "ProposalCancelled")
        .withArgs(projectId, id, alice.address);

      await expect(registry.activateProposal(id))
        .to.be.revertedWithCustomError(registry, "ProposalNotPending")
        .withArgs(id, Status.Cancelled);
      await expect(registry.connect(alice).cancelProposal(id)).to.be.revertedWithCustomError(registry, "ProposalNotPending");
      expect((await registry.getProject(projectId)).activeVersion).to.equal(1n);
    });
  });

  // -------------------------------------------------------------------------
  describe("history", () => {
    it("preserves every earlier version unchanged as new versions activate", async () => {
      const { registry, alice, bob, carol, dave, projectId } = await loadFixture(activeProjectFixture);
      const [v1Info, v1Splits] = await registry.getAgreement(projectId, 1);

      const p2 = await propose(registry, alice, projectId, [split(alice, 6000), split(bob, 4000)]);
      await approveAll(registry, p2, [alice, bob, carol]);
      await registry.activateProposal(p2);

      const p3 = await propose(registry, bob, projectId, [split(alice, 5000), split(bob, 2500), split(dave, 2500)]);
      await approveAll(registry, p3, [alice, bob, dave]);
      await registry.activateProposal(p3);

      const [v1InfoAfter, v1SplitsAfter] = await registry.getAgreement(projectId, 1);
      expect(v1InfoAfter).to.deep.equal(v1Info);
      expect(tuples(v1SplitsAfter)).to.deep.equal(tuples(v1Splits));
      expect(tuples(v1SplitsAfter)).to.deep.equal([
        [alice.address, 5000],
        [bob.address, 3000],
        [carol.address, 2000],
      ]);

      const [v2Info, v2Splits] = await registry.getAgreement(projectId, 2);
      expect(v2Info.proposalId).to.equal(p2);
      expect(tuples(v2Splits)).to.deep.equal([
        [alice.address, 6000],
        [bob.address, 4000],
      ]);

      const [v3Info, v3Splits] = await registry.getAgreement(projectId, 3);
      expect(v3Info.proposalId).to.equal(p3);
      expect(v3Info.activatedBlock).to.be.greaterThan(v2Info.activatedBlock);
      expect(tuples(v3Splits)).to.deep.equal([
        [alice.address, 5000],
        [bob.address, 2500],
        [dave.address, 2500],
      ]);

      // Activated proposals cannot be re-activated to overwrite anything.
      await expect(registry.activateProposal(p2))
        .to.be.revertedWithCustomError(registry, "ProposalNotPending")
        .withArgs(p2, Status.Activated);
    });

    it("reverts for versions that do not exist", async () => {
      const { registry, alice, projectId } = await loadFixture(activeProjectFixture);
      for (const version of [0, 2]) {
        await expect(registry.getAgreement(projectId, version))
          .to.be.revertedWithCustomError(registry, "VersionNotFound")
          .withArgs(projectId, version);
        await expect(registry.shareInVersion(projectId, version, alice.address)).to.be.revertedWithCustomError(
          registry,
          "VersionNotFound",
        );
      }
    });

    it("keeps projects independent", async () => {
      const { registry, creator, alice, bob, dave, projectId } = await loadFixture(activeProjectFixture);
      await registry.connect(creator).createProject("Other", ContentType.Podcast, [split(dave, 10000)]);
      // Approving project 2's proposal doesn't affect project 1, and project 1 contributors can't vote on it.
      await expect(registry.connect(alice).approveProposal(2n)).to.be.revertedWithCustomError(registry, "NotRequiredApprover");
      await registry.connect(dave).approveProposal(2n);
      await registry.activateProposal(2n);
      expect(await registry.isActiveContributor(2n, dave.address)).to.equal(true);
      expect(await registry.isActiveContributor(projectId, dave.address)).to.equal(false);
      expect(await registry.isActiveContributor(2n, bob.address)).to.equal(false);
    });
  });

  // -------------------------------------------------------------------------
  it("rejects plain ETH transfers (revenue must go through deposit)", async () => {
    const { registry, creator } = await loadFixture(deployFixture);
    await expect(creator.sendTransaction({ to: await registry.getAddress(), value: 1n })).to.be.reverted;
  });
});
