import { ethers, network } from "hardhat";

// Local-only deployment helper. Refuses to run against anything other than a
// local Hardhat chain — no public networks are configured in this milestone.
async function main() {
  if (network.config.chainId !== 31337) {
    throw new Error(`Refusing to deploy to non-local network "${network.name}".`);
  }
  const registry = await ethers.deployContract("CollaborationRegistry");
  await registry.waitForDeployment();
  console.log(`CollaborationRegistry deployed to ${await registry.getAddress()} on ${network.name}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
