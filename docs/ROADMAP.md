# Roadmap

Each milestone is reviewed before the next begins.

1. **Scaffold** ✅ — monorepo, dashboard UI with demo data, read-only MetaMask connection, minimal registry contract.
2. **Agreement lifecycle (contracts)** ✅ — immutable versioned agreements, proposals for adding/removing contributors
   and changing shares, per-wallet approvals and rejections, strict unanimous activation, events, Hardhat tests.
3. **Revenue accounting & claims (contracts)** ✅ — native ETH deposits attributed to the active agreement version,
   immediate per-contributor allocation with explicit rounding remainder, pull-based claims with reentrancy
   protection; removed contributors keep earlier earnings.
4. **Web app ↔ contract integration (local)** ✅ — Live workspace: MetaMask connection and network switching, create
   projects, propose/approve/reject/cancel/activate, agreement history, test-ETH deposits and claims, transaction
   states and error messages; deployment address via a generated, git-ignored config file.
5. **Live dashboard data & indexing** — replace the demo stats, earnings chart and activity feed with indexed contract
   events; per-project indexes instead of counter scans.
6. **ERC-20 revenue & threat model** — stablecoin support, external review of the accounting design.
7. **Testnet deployment** — deploy to a public testnet; never mainnet without an external audit.
