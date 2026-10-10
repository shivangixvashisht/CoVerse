# CoVerse

**Create together. Get paid fairly.**

CoVerse is a blockchain-powered revenue-sharing platform for collaborative content creation — music, films,
documentaries, docuseries, long-form video, short-form video and podcasts. Collaborators agree on how revenue is split,
every change to the split needs every affected contributor's on-chain approval, and revenue deposited for a project is
credited by the agreed split and claimed by each contributor from their own wallet.

> **Status: Milestone 4 — browser app integrated with the contract on a local Hardhat chain.** The **Live workspace**
> in the web app creates projects, proposes and votes on agreements, deposits test ETH and claims earnings through
> MetaMask against a locally deployed contract. The rest of the dashboard is a **design preview with demo data**.
> Local test network only: nothing is deployed publicly and no real funds are used.

## Current state

| Area | State |
| --- | --- |
| Web app (React + Vite + TypeScript, responsive, browser-based) | Live workspace on real contract data + labelled demo-data design preview |
| MetaMask (ethers.js v6) | Connect, show account/chain, switch/add Hardhat Local, sign transactions |
| Projects & agreements | **Integrated**: create project, propose changes, approve / reject / cancel / activate, full version history |
| Proposal status | **Integrated**: required contributors and each one's vote read from the contract (`getRequiredApprovers`, `voteOf`) |
| Revenue | **Integrated**: deposit test ETH against the active version; claim / partial claim of the connected wallet's own balance; deposit history |
| Transaction handling | Awaiting signature → pending (tx hash) → confirmed / failed, with messages for rejection, wrong network, insufficient test ETH, reverts and stale nonces |
| `CollaborationRegistry.sol` | Versioned immutable agreements, unanimous approval, version-attributed revenue, reentrancy-safe claims |
| Stats, earnings chart, demo projects, activity feed | **Demo data** (tagged in the UI) |
| Public testnet / mainnet, ERC-20, audit, indexer | Not implemented |

Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · Faculty demo script: [docs/DEMO.md](docs/DEMO.md) ·
Plan: [docs/ROADMAP.md](docs/ROADMAP.md)

## Repository layout

```
.
├── frontend/                    React + Vite + TypeScript web app
│   ├── public/deployments/      <chainId>.json written by the deploy script (git-ignored)
│   └── src/
│       ├── components/          dashboard UI (header, hero, demo preview panels, …)
│       │   └── live/            Live workspace: projects, proposals, votes, deposits, claims
│       ├── config/              network (Hardhat Local) and contract-address resolution
│       ├── contracts/           CollaborationRegistry ABI (generated, checked by a test)
│       ├── data/                demo.ts (sample data for the design preview) + selectors
│       ├── hooks/               useWallet (MetaMask), useTransaction (tx states)
│       ├── lib/                 registryClient (contract reads/writes), txErrors, splits, formatting
│       └── styles/              global.css (design tokens, dark + light)
├── contracts/                   Hardhat workspace
│   ├── contracts/               CollaborationRegistry.sol (+ test-only helper contracts)
│   ├── test/                    contract tests + frontend-client integration test
│   └── scripts/                 deploy.ts (local only), export-abi.ts
├── docs/                        ARCHITECTURE.md, DEMO.md, ROADMAP.md
└── package.json                 npm workspaces root
```

## Prerequisites

- Node.js 20+ (22 recommended — see `.nvmrc`) and npm 10+
- A desktop browser with the [MetaMask](https://metamask.io/download/) extension (Chrome, Brave, Firefox or Edge)

## Quick start (local blockchain + web app)

Use **three terminals**, all in the repository root.

```bash
# once
npm install

# terminal 1 — local blockchain (keep it running)
npm run contracts:node

# terminal 2 — deploy the contract to it (re-run every time you restart terminal 1)
npm run contracts:deploy

# terminal 3 — the web app
npm run dev            # open http://localhost:5173
```

`npm run contracts:node` starts Hardhat's local chain at **http://127.0.0.1:8545, chain ID 31337** and prints 20 funded
test accounts with their private keys. Those are Hardhat's **public, well-known test keys** — anyone can use them, so
never send real funds to those addresses and never import them into a wallet you use for real money.

`npm run contracts:deploy` deploys `CollaborationRegistry` and writes `frontend/public/deployments/31337.json` with the
address. The web app reads that file at runtime, so nothing is hardcoded. The file is git-ignored because the address
can change whenever the local chain restarts.

> If the Solidity compiler download is blocked on your network, prefix the contract commands with
> `HARDHAT_USE_SOLCJS=true` (e.g. `HARDHAT_USE_SOLCJS=true npm run contracts:deploy`).

### Connect MetaMask to the local chain

1. Open http://localhost:5173 and click **Connect wallet**.
2. In the **Live workspace**, click **Switch to Hardhat Local** — MetaMask offers to add/switch to the network
   (RPC `http://127.0.0.1:8545`, chain ID `31337`, currency ETH). You can also add it manually in MetaMask.
3. Import a few test accounts: MetaMask → account menu → **Add account or hardware wallet → Import account**, and paste
   a private key printed by terminal 1 (e.g. Account #1, #2, #3). Use a separate MetaMask profile for testing.
4. Switch between imported accounts in MetaMask to act as different contributors; the app follows the selected account.

### After restarting the local chain

Restarting `npm run contracts:node` wipes the chain. Then:

1. Run `npm run contracts:deploy` again and reload the page (the app tells you if the contract is missing).
2. In MetaMask, clear the stale transaction history for each test account: **Settings → Advanced → Clear activity tab
   data**. Otherwise MetaMask reuses old nonces ("nonce too high"); the app shows this hint if it happens.

### Optional configuration

Copy `frontend/.env.example` to `frontend/.env.local` to set `VITE_REGISTRY_ADDRESS` (explicit contract address),
`VITE_REGISTRY_CHAIN_ID` or `VITE_RPC_URL`. These are public build-time values — never put keys or secrets in them.
Only the local Hardhat chain (31337) is accepted.

## Commands

```bash
npm run dev                       # web app dev server
npm run build                     # type-check + production build (frontend/dist)
npm run lint                      # ESLint
npm test                          # frontend (Vitest) + contract (Hardhat) tests
npm run test --workspace frontend # frontend tests only
npm run contracts:test            # contract tests only (includes the frontend-client integration test)
npm run contracts:compile
npm run contracts:node            # local chain
npm run contracts:deploy          # deploy to the local chain + write the frontend deployment file
npm run contracts:export-abi      # regenerate frontend/src/contracts/CollaborationRegistry.abi.json after contract changes
```

Run every check: `npm run lint && npm run build && npm test`

## Security notes

- No private keys, seed phrases or secrets are stored in this repository. Test keys come from `hardhat node` at runtime.
- The app only talks to chain 31337 and re-checks the wallet's chain before every transaction.
- Every approval, rejection, deposit and claim is a MetaMask transaction from the connected wallet. There are no admin
  overrides, delegated approvals or off-chain substitutes; the UI never infers votes — it reads them from the contract.
- Claims always pay the connected wallet from its own balance; deposits always name the agreement version shown.
- Not audited. Do not deploy with real funds.
