# Architecture

## Overview

CoVerse is a browser-based web application in an npm-workspaces monorepo with two packages:

- **`frontend/`** — a React 19 single-page app built with Vite and TypeScript.
- **`contracts/`** — a Hardhat 2 project with Solidity contracts, TypeScript tests and scripts.

They share no code yet. When the frontend starts reading contract state, ABIs will be consumed from the Hardhat
build output (or generated TypeChain types) rather than copied by hand.

## Frontend

- **Data:** all dashboard content comes from `src/data/demo.ts` and is labelled "Demo data" in the UI (a page-level
  banner plus per-panel tags). `src/data/selectors.ts` derives the summary figures from that data, so the numbers stay
  internally consistent. **The frontend does not read from or write to the contract yet.**
- **Wallet:** `src/hooks/useWallet.ts` wraps MetaMask's EIP-1193 provider with ethers.js `BrowserProvider`. It only
  calls `eth_accounts`, `eth_requestAccounts` and `eth_chainId`, and reacts to `accountsChanged` / `chainChanged`.
  ethers is lazy-loaded so it isn't in the initial bundle. A test asserts no other RPC methods are called.
- **Styling:** plain CSS with design tokens in `src/styles/global.css`. Dark theme by default, light theme via
  `prefers-color-scheme`. Chart and split colours use a fixed categorical order checked for colour-blind separation;
  every chart has a text/table equivalent.

## Contracts: agreement lifecycle (`CollaborationRegistry.sol`)

### Concepts

| Term | Meaning |
| --- | --- |
| **Project** | Title, content type, creator, and the number of its active agreement version (`0` = none yet). |
| **Agreement version** | An immutable list of `(contributor, shareBps)` pairs totalling 10 000 bps (100%), plus the proposal that created it and the timestamp/block it activated. Versions are numbered 1, 2, 3, … per project. |
| **Proposal** | A *complete* replacement contributor list. One proposal can add contributors, remove contributors and change shares at the same time. |
| **Required approvers** | Every contributor active under the agreement the proposal is based on **plus** every contributor the proposal adds. For an initial agreement this is everyone listed. |

### Proposal state machine

```
                      approveProposal (each required approver, once)
                     ┌──────────────┐
                     ▼              │
  createProject / ┌─────────┐───────┘     activateProposal          ┌───────────┐
  proposeAgreement│ Pending │──── (all required approvals) ────────▶│ Activated │──▶ becomes version N+1
  ───────────────▶└─────────┘                                       └───────────┘
                    │  │  │
   rejectProposal   │  │  │  another proposal on the same base       ┌────────────┐
   (any required ───┘  │  └─── version activates first ─────────────▶│ Superseded │ (derived, terminal)
    approver)          │                                             └────────────┘
         ▼             │ cancelProposal (proposer only)
   ┌──────────┐        ▼
   │ Rejected │   ┌───────────┐
   └──────────┘   │ Cancelled │
                  └───────────┘
```

`Activated`, `Rejected`, `Cancelled` and `Superseded` are terminal. `Superseded` is not stored: `getProposal` reports
a pending proposal as superseded when the project's active version is no longer the version it was based on, and every
state-changing call on it reverts with `ProposalSuperseded`.

### Rules enforced on-chain

1. **Who may propose.** Before any agreement is active, only the project creator (to propose a new initial agreement
   after a rejection). Once an agreement is active, only contributors active under it. Removed contributors lose this
   right; added contributors gain it. The creator has no special power once version 1 is active unless they are a
   contributor.
2. **Valid splits.** 1–50 contributors; no zero address; no duplicates; no zero share; total exactly 10 000 bps.
   A proposal identical to the current agreement (in any order) reverts with `NoChange`.
3. **Votes are wallet transactions.** `approveProposal` / `rejectProposal` record a vote for `msg.sender` only. There
   is no signature relaying, delegation or admin override, so only the contributor's own wallet can vote for them.
   Proposing does not count as approving.
4. **One vote per address per proposal.** A second approval, or switching approve → reject, reverts with
   `AlreadyVoted`.
5. **Strict unanimity.** `activateProposal` reverts with `MissingApprovals` unless *every* required approver has
   approved. A single rejection permanently rejects the proposal.
6. **Activation is permissionless** (any account can call it) because every condition is checked on-chain; the caller
   cannot affect the outcome.
7. **No silent replacement.** The active version changes only inside `activateProposal`. Pending, rejected, cancelled
   and superseded proposals never change it.
8. **History is append-only.** A version's splits are written once, at activation, to a new version number. No
   function modifies or deletes a version; a proposal can only activate once, and only on top of the version it was
   based on.
9. **No funds.** There are no payable functions and no `receive`/`fallback`, so the contract cannot hold ETH.

### Events

| Event | Emitted when |
| --- | --- |
| `ProjectCreated(projectId, creator, contentType, title)` | A project is created. |
| `ProposalCreated(projectId, proposalId, proposer, baseVersion, requiredApprovals)` | Any proposal, including the initial one. |
| `ProposalApproved(projectId, proposalId, approver, approvalCount, requiredApprovals)` | A required approver approves. |
| `ProposalRejected(projectId, proposalId, rejecter)` | A required approver rejects (proposal becomes `Rejected`). |
| `ProposalCancelled(projectId, proposalId, proposer)` | The proposer withdraws a pending proposal. |
| `AgreementActivated(projectId, version, proposalId)` | A fully approved proposal becomes the new version. |

### Removed contributors and revenue (not yet implemented)

**Revenue accounting and claims do not exist yet, so no revenue protection is provided today.** The contract
lays the groundwork: each version records its splits and the block/time it activated, and old versions remain readable
(`getAgreement`, `shareInVersion`). The intended design for a later milestone is that revenue is attributed to the
version active when it is received, so a removed contributor keeps any entitlement accrued under earlier versions but
receives nothing under versions that exclude them. That behaviour must be implemented and tested before it can be
relied on.

### Security assumptions and known limitations

- **Wallet security is the user's responsibility.** Whoever controls a contributor's private key can vote as them.
  Losing a key means that contributor can no longer approve, which blocks every future change (unanimity). There is no
  recovery or address-rotation mechanism yet.
- **Unanimity can deadlock.** Any single required approver can block a change indefinitely by rejecting or not voting.
  This is intentional for this milestone; dispute or timeout mechanisms are future work.
- **No proposal expiry.** Pending proposals stay open until approved, rejected, cancelled or superseded.
- **Spam projects are possible.** Anyone can create a project naming any addresses as contributors. It has no effect
  until every named contributor approves, so UIs must only treat **activated** agreements as binding and should never
  present a pending proposal as an agreement.
- **Frontends cannot approve on anyone's behalf.** A UI notification, email or off-chain signature is not an approval;
  only the `ProposalApproved` event from the contributor's own transaction is.
- **Not audited.** Local Hardhat network only. Do not deploy with real funds.

## Not yet designed / implemented

- Revenue intake, accounting and claims (pull-payment, ETH/ERC-20)
- Frontend flows for creating proposals and voting
- Indexing / reading contract events in the UI
- Key loss / address rotation, proposal expiry, dispute resolution
- Target chain selection, audits and deployment process
