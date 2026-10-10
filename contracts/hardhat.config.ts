import { HardhatUserConfig, subtask } from "hardhat/config";
import { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } from "hardhat/builtin-tasks/task-names";
import "@nomicfoundation/hardhat-toolbox";
import path from "path";

const SOLC_VERSION = "0.8.28";

// Optional: compile with the solc-js build shipped in the `solc` npm package
// instead of downloading the native compiler. Enable with HARDHAT_USE_SOLCJS=true.
if (process.env.HARDHAT_USE_SOLCJS === "true") {
  subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, async (args: { solcVersion: string }, _hre, runSuper) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const solcPkg = require("solc/package.json") as { version: string };
    if (args.solcVersion !== solcPkg.version) {
      return runSuper();
    }
    return {
      compilerPath: path.join(path.dirname(require.resolve("solc/package.json")), "soljson.js"),
      isSolcJs: true,
      version: args.solcVersion,
      longVersion: args.solcVersion,
    };
  });
}

const config: HardhatUserConfig = {
  solidity: {
    version: SOLC_VERSION,
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    // Local development only. No public networks are configured in this milestone.
    hardhat: { chainId: 31337 },
    localhost: { url: "http://127.0.0.1:8545", chainId: 31337 },
  },
};

export default config;
