# Roadmap

Each milestone is reviewed before the next begins.

1. **Scaffold** ✅ — monorepo, dashboard UI with demo data, read-only MetaMask connection, minimal registry contract.
2. **Agreement lifecycle (contracts)** ✅ — immutable versioned agreements, proposals for adding/removing contributors
   and changing shares, per-wallet approvals and rejections, strict unanimous activation, events, Hardhat tests.
3. **Agreement UI** — create projects and proposals, approve/reject from MetaMask, read agreements and history from a
   local Hardhat chain.
4. **Revenue accounting & claims** — attribute revenue to the agreement version active when it arrives; pull-based
   claims for ETH/ERC-20 so removed contributors keep earlier entitlements; extensive tests and a threat model.
5. **Testnet deployment** — deploy to a public testnet; never mainnet without an external audit.
