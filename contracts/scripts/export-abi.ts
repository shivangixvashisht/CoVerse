import { artifacts } from "hardhat";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";

/** Path of the ABI copy the browser app imports. Kept in sync by a contract test. */
export const FRONTEND_ABI_PATH = path.join(__dirname, "../../frontend/src/contracts/CollaborationRegistry.abi.json");

async function main() {
  const { abi } = await artifacts.readArtifact("CollaborationRegistry");
  mkdirSync(path.dirname(FRONTEND_ABI_PATH), { recursive: true });
  writeFileSync(FRONTEND_ABI_PATH, JSON.stringify(abi, null, 2) + "\n");
  console.log(`Wrote ${abi.length} ABI entries to ${path.relative(process.cwd(), FRONTEND_ABI_PATH)}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
