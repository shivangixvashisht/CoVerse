# CoVerse

**Create together. Get paid fairly.**

CoVerse is a blockchain-powered revenue-sharing platform for collaborative content creation — music, films,
documentaries, docuseries, long-form video, short-form video and podcasts. Collaborators agree on how revenue is split,
the split is recorded on-chain, and (in later milestones) incoming revenue is distributed automatically.

> **Status: Milestone 3 — revenue accounting & claims (contracts).** The smart contract now accepts test-ETH
> deposits and lets contributors claim their earnings, verified by Hardhat tests on a local chain. The dashboard still
> shows **demo data only** and does not talk to the contract; no payments can be made from the UI. Nothing is deployed.

## Current state

| Area | State |
| --- | --- |
| Frontend (React + Vite + TypeScript, browser web app) | Landing/dashboard with clearly labelled demo data |
| MetaMask connection (ethers.js v6) | Read-only: requests account access and reads the network |
| `CollaborationRegistry.sol` — agreements | Versioned, immutable revenue-split agreements. Changes are proposed, then need an on-chain approval from **every** affected contributor's own wallet before activating. |
| `CollaborationRegistry.sol` — revenue | ETH deposits attributed to the active agreement version; per-contributor balances with explicit rounding remainder; pull-based, reentrancy-safe claims. Removed contributors keep earlier earnings. |
| Contract tests (Hardhat + Chai) | Passing — see `contracts/test/` |
| Deployments | None. Local Hardhat network only. |
| UI for deposits, claims, proposals and voting | Not implemented |
| ERC-20 revenue, audit, public deployment | Not implemented |

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the agreement state machine, revenue accounting, rounding rules,
security assumptions, and what is implemented vs planned.

## Repository layout

```
.
├── frontend/                 React + Vite + TypeScript app
│   ├── src/
│   │   ├── components/       UI components (header, stats, chart, split, projects, …)
│   │   ├── data/             demo.ts (sample data) + selectors
│   │   ├── hooks/            useWallet (MetaMask via ethers.js)
│   │   ├── lib/              formatting, chain names, chart series colours
│   │   ├── styles/           global.css (design tokens, dark + light)
│   │   └── test/             Vitest setup
│   └── public/
├── contracts/                Hardhat workspace
│   ├── contracts/            Solidity sources (CollaborationRegistry)
│   ├── test/                 Contract tests (Mocha/Chai, TypeScript)
│   ├── scripts/              Local-only deploy script
│   └── hardhat.config.ts
├── docs/                     Architecture notes and roadmap
└── package.json              npm workspaces root
```

## Prerequisites

- Node.js 20+ (22 recommended — see `.nvmrc`) and npm 10+
- [MetaMask](https://metamask.io/download/) browser extension (optional — only needed to try wallet connection)

## Setup

```bash
git clone https://github.com/shivangixvashisht/CoVerse.git
cd CoVerse
npm install          # installs both workspaces
```

## Run the frontend

```bash
npm run dev          # http://localhost:5173
```

Other frontend commands (run from the repo root):

```bash
npm run build                          # type-check + production build to frontend/dist
npm run lint                           # ESLint
npm run test --workspace frontend      # Vitest + Testing Library
npm run preview --workspace frontend   # serve the production build
```

## Smart contracts

```bash
npm run contracts:compile
npm run contracts:test
```

Hardhat downloads the Solidity compiler (0.8.28) from `binaries.soliditylang.org` on first compile. If that host is
blocked on your network, use the solc-js build bundled from npm instead:

```bash
HARDHAT_USE_SOLCJS=true npm run contracts:test
```

### Optional: local chain

```bash
npm run contracts:node                                   # terminal 1: local Hardhat chain on :8545 (chainId 31337)
npm run deploy:local --workspace contracts               # terminal 2: deploy the registry locally
```

The deploy script refuses to run on any network other than chainId 31337. The accounts printed by `hardhat node`
are **public, well-known test keys** — never send real funds to them. The frontend does not yet read from the
deployed contract.

### Trying wallet connection

Click **Connect wallet**. CoVerse requests account access (`eth_requestAccounts`) and reads the chain ID — nothing
else. If you're on a non-test network the wallet menu shows a warning. "Disconnect" clears the app's state; to revoke
the site permission entirely, use MetaMask's *Connected sites* settings.

## Run every check

```bash
npm run lint && npm run build && npm test
```

## Security notes

- No secrets are required or stored. `.env` files are git-ignored; only `.env.example` files are committed.
- Frontend `VITE_*` variables are bundled into public client code — never put keys there.
- No public networks are configured in `hardhat.config.ts`.

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)
