# Architecture (Milestone 1)

## Overview

CoVerse is an npm-workspaces monorepo with two packages:

- **`frontend/`** — a React 19 single-page app built with Vite and TypeScript.
- **`contracts/`** — a Hardhat 2 project with Solidity contracts, TypeScript tests and scripts.

They share no code yet. When the frontend starts reading contract state, ABIs will be consumed from the Hardhat
build output (or generated TypeChain types) rather than copied by hand.

## Frontend

- **Data:** all dashboard content comes from `src/data/demo.ts` and is labelled "Demo data" in the UI (a page-level
  banner plus per-panel tags). `src/data/selectors.ts` derives the summary figures from that data, so the numbers stay
  internally consistent.
- **Wallet:** `src/hooks/useWallet.ts` wraps MetaMask's EIP-1193 provider with ethers.js `BrowserProvider`. It only
  calls `eth_accounts`, `eth_requestAccounts` and `eth_chainId`, and reacts to `accountsChanged` / `chainChanged`.
  ethers is lazy-loaded so it isn't in the initial bundle. A test asserts no other RPC methods are called.
- **Styling:** plain CSS with design tokens in `src/styles/global.css`. Dark theme by default, light theme via
  `prefers-color-scheme`. Chart and split colours use a fixed categorical order checked for colour-blind separation;
  every chart has a text/table equivalent.

## Contracts

`CollaborationRegistry.sol` stores, per project: owner, title, content type, creation time, and a list of
`(contributor, shareBps)` pairs. Registration validates that:

- the title is non-empty;
- there are 1–50 contributors, none the zero address, none duplicated, none with a zero share;
- shares sum to exactly 10 000 basis points (100%).

It has no `receive`/`fallback` and no payable functions, so it cannot hold ETH. Splits are immutable once registered —
amendment and approval flows are deliberately left for a later milestone.

## Not yet designed / implemented

- Revenue intake and distribution (pull-payment splitter, ERC-20 support)
- Contributor approval of a split before it becomes binding
- Indexing / reading contract events in the UI
- Target chain selection, audits and deployment process
