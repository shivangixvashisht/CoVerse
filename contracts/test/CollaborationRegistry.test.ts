import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

const ContentType = { Music: 0, Film: 1, Documentary: 2, Docuseries: 3, LongFormVideo: 4, ShortFormVideo: 5, Podcast: 6 };

describe("CollaborationRegistry", () => {
  async function deployFixture() {
    const [owner, alice, bob, carol] = await ethers.getSigners();
    const registry = await ethers.deployContract("CollaborationRegistry");
    return { registry, owner, alice, bob, carol };
  }

  it("registers a project with a valid 100% split", async () => {
    const { registry, owner, alice, bob } = await loadFixture(deployFixture);
    const splits = [
      { contributor: alice.address, shareBps: 6000 },
      { contributor: bob.address, shareBps: 4000 },
    ];

    await expect(registry.registerProject("Midnight Sessions", ContentType.Music, splits))
      .to.emit(registry, "ProjectRegistered")
      .withArgs(1n, owner.address, ContentType.Music, "Midnight Sessions");

    expect(await registry.projectCount()).to.equal(1n);
    const project = await registry.getProject(1);
    expect(project.owner).to.equal(owner.address);
    expect(project.title).to.equal("Midnight Sessions");
    const stored = await registry.getSplits(1);
    expect(stored.map((s) => [s.contributor, s.shareBps])).to.deep.equal([
      [alice.address, 6000n],
      [bob.address, 4000n],
    ]);
  });

  it("rejects splits that do not total 100%", async () => {
    const { registry, alice, bob } = await loadFixture(deployFixture);
    await expect(
      registry.registerProject("Short", ContentType.Podcast, [
        { contributor: alice.address, shareBps: 5000 },
        { contributor: bob.address, shareBps: 4000 },
      ]),
    )
      .to.be.revertedWithCustomError(registry, "SharesMustTotal100Percent")
      .withArgs(9000n);
  });

  it("rejects duplicate, zero-address and zero-share contributors", async () => {
    const { registry, alice } = await loadFixture(deployFixture);
    await expect(
      registry.registerProject("Dup", ContentType.Film, [
        { contributor: alice.address, shareBps: 5000 },
        { contributor: alice.address, shareBps: 5000 },
      ]),
    ).to.be.revertedWithCustomError(registry, "DuplicateContributor");

    await expect(
      registry.registerProject("Zero addr", ContentType.Film, [{ contributor: ethers.ZeroAddress, shareBps: 10000 }]),
    ).to.be.revertedWithCustomError(registry, "ZeroAddressContributor");

    await expect(
      registry.registerProject("Zero share", ContentType.Film, [
        { contributor: alice.address, shareBps: 10000 },
        { contributor: ethers.Wallet.createRandom().address, shareBps: 0 },
      ]),
    ).to.be.revertedWithCustomError(registry, "ZeroShare");
  });

  it("rejects empty titles and empty contributor lists", async () => {
    const { registry, alice } = await loadFixture(deployFixture);
    await expect(
      registry.registerProject("", ContentType.Music, [{ contributor: alice.address, shareBps: 10000 }]),
    ).to.be.revertedWithCustomError(registry, "EmptyTitle");
    await expect(registry.registerProject("Solo", ContentType.Music, [])).to.be.revertedWithCustomError(
      registry,
      "NoContributors",
    );
  });

  it("reverts when reading an unknown project", async () => {
    const { registry } = await loadFixture(deployFixture);
    await expect(registry.getProject(1)).to.be.revertedWithCustomError(registry, "ProjectNotFound").withArgs(1n);
    await expect(registry.getSplits(0)).to.be.revertedWithCustomError(registry, "ProjectNotFound").withArgs(0n);
  });

  it("cannot receive ETH (no funds are handled in this milestone)", async () => {
    const { registry, owner } = await loadFixture(deployFixture);
    await expect(owner.sendTransaction({ to: await registry.getAddress(), value: 1n })).to.be.reverted;
  });
});
