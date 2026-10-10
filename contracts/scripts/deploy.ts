import { ethers, network } from "hardhat";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";

// Local-only deployment helper. Refuses to run against anything other than a
// local Hardhat chain — no public networks are configured.
async function main() {
  if (network.config.chainId !== 31337) {
    throw new Error(`Refusing to deploy to non-local network "${network.name}".`);
  }
  const registry = await ethers.deployContract("CollaborationRegistry");
  await registry.waitForDeployment();
  const address = await registry.getAddress();
  const receipt = await registry.deploymentTransaction()!.wait();
  console.log(`CollaborationRegistry deployed to ${address} on ${network.name}`);
  console.log("Projects start with a pending initial agreement; contributors must approve from their own wallets.");

  // Tell the browser app where the contract lives. Only for a persistent `hardhat node`
  // (`--network localhost`); the in-process `hardhat` network disappears when the script ends.
  if (network.name === "localhost") {
    const file = path.join(__dirname, "../../frontend/public/deployments/31337.json");
    mkdirSync(path.dirname(file), { recursive: true });
    const deployment = {
      contract: "CollaborationRegistry",
      chainId: 31337,
      address,
      deployBlock: receipt!.blockNumber,
      deployedAt: new Date().toISOString(),
    };
    writeFileSync(file, JSON.stringify(deployment, null, 2) + "\n");
    console.log(`Wrote frontend deployment config: ${path.relative(process.cwd(), file)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
