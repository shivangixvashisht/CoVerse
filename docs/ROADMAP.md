# Roadmap

Each milestone is reviewed before the next begins.

1. **Scaffold** ✅ — monorepo, dashboard UI with demo data, read-only MetaMask connection, minimal registry contract.
2. **Agreement lifecycle (contracts)** ✅ — immutable versioned agreements, proposals for adding/removing contributors
   and changing shares, per-wallet approvals and rejections, strict unanimous activation, events, Hardhat tests.
3. **Revenue accounting & claims (contracts)** ✅ — native ETH deposits attributed to the active agreement version,
   immediate per-contributor allocation with explicit rounding remainder, pull-based claims with reentrancy
   protection; removed contributors keep earlier earnings.
4. **Agreement & revenue UI** — create projects and proposals, approve/reject, deposit test ETH and claim from MetaMask
   against a local Hardhat chain; read agreements, history and balances.
5. **ERC-20 revenue & threat model** — stablecoin support, external review of the accounting design.
6. **Testnet deployment** — deploy to a public testnet; never mainnet without an external audit.
