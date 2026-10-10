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
  internally consistent. **The frontend does not read from or write to the contract yet** — there is no in-app
  deposit, claim, proposal or voting flow, and no wallet payments are made from the UI.
- **Wallet:** `src/hooks/useWallet.ts` wraps MetaMask's EIP-1193 provider with ethers.js `BrowserProvider`. It only
  calls `eth_accounts`, `eth_requestAccounts` and `eth_chainId`, and reacts to `accountsChanged` / `chainChanged`.
  ethers is lazy-loaded so it isn't in the initial bundle. A test asserts no other RPC methods are called.
- **Styling:** plain CSS with design tokens in `src/styles/global.css`. Dark theme by default, light theme via
  `prefers-color-scheme`. Chart and split colours use a fixed categorical order checked for colour-blind separation;
  every chart has a text/table equivalent.

## Implemented vs planned

| Capability | Status |
| --- | --- |
| Versioned agreements, proposals, per-wallet approvals/rejections, unanimous activation | **Implemented & tested** (contract) |
| ETH revenue deposits attributed to the active agreement version | **Implemented & tested** (contract) |
| Per-contributor entitlements, claims, rounding remainder handling | **Implemented & tested** (contract) |
| Removed contributors keep earlier earnings; get nothing from later versions | **Implemented & tested** (contract) |
| Frontend: read agreements / balances, deposit, claim, propose, vote | Planned — not built |
| ERC-20 / stablecoin revenue | Planned — not built |
| Key loss / address rotation, proposal expiry, dispute resolution | Planned — not designed |
| Public testnet deployment, external audit | Planned |

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
9. **ETH only via `deposit`.** There is no `receive`/`fallback`, so plain ETH transfers revert; the only payable
   function is `deposit` (see *Revenue accounting* below).

### Events

| Event | Emitted when |
| --- | --- |
| `ProjectCreated(projectId, creator, contentType, title)` | A project is created. |
| `ProposalCreated(projectId, proposalId, proposer, baseVersion, requiredApprovals)` | Any proposal, including the initial one. |
| `ProposalApproved(projectId, proposalId, approver, approvalCount, requiredApprovals)` | A required approver approves. |
| `ProposalRejected(projectId, proposalId, rejecter)` | A required approver rejects (proposal becomes `Rejected`). |
| `ProposalCancelled(projectId, proposalId, proposer)` | The proposer withdraws a pending proposal. |
| `AgreementActivated(projectId, version, proposalId)` | A fully approved proposal becomes the new version. |

## Contracts: revenue accounting and claims

### Deposits

`deposit(projectId, expectedVersion)` is `payable` and may be called by anyone (e.g. a distributor). It reverts with:

- `ProjectNotFound` — unknown project;
- `NoActiveAgreement` — no agreement has been activated yet;
- `VersionMismatch(expected, active)` — the active version is not the one the depositor intended to fund. This protects
  depositors from a new version activating just before their transaction (same block / front-running);
- `ZeroDeposit` — `msg.value == 0`.

A successful deposit is stored (`getDeposit`: project, version, depositor, amount, time), added to
`versionRevenue(projectId, version)` and emits `RevenueDeposited(projectId, version, depositId, depositor, amount)`.

### Attribution and entitlements

Each deposit is **allocated immediately** using the shares of the version active at deposit time, which are immutable.
For each contributor of that version:

```
portion_i = floor(amount × shareBps_i / 10 000)
```

and the portion is credited to the contributor's project balance and to `earnedInVersion(projectId, version, account)`.
Because versions never change and later deposits use later versions:

- **Removed contributors keep everything already credited** and can claim it at any time — claims do not require being
  an active contributor.
- **Removed contributors receive nothing from deposits made under later versions** that exclude them, and newly added
  contributors receive nothing from deposits made before they joined.
- Deposits made while a proposal is pending go to the current (old) version — a proposal changes nothing until activated.

### Rounding

`Σ floor(...)` can fall short of `amount` by at most *(number of contributors − 1)* wei; it can never exceed it. The
shortfall (`remainder = amount − Σ portion_i`) is credited **explicitly** to the contributor with the **largest share in
that version** (the first listed on a tie) and emits `RemainderAllocated(projectId, depositId, recipient, remainder)`.
So every deposit is allocated exactly — nothing more, nothing less, and no unaccounted dust.

**Invariant (tested):** the contract's ETH balance equals the sum of all contributors' unclaimed balances across all
projects, and each project's total allocations equal its total deposits.

### Claims

- `claim(projectId, amount)` — withdraw part of the caller's unclaimed balance. Reverts `ZeroClaim` for 0 and
  `InsufficientBalance(available, requested)` if `amount` exceeds the balance.
- `claimAll(projectId)` — withdraw everything; reverts `NothingToClaim` if the balance is 0.
- Funds are only ever sent to `msg.sender`, from `msg.sender`'s own balance, so **only the entitled wallet can claim its
  earnings** and no one can claim for (or redirect) someone else's balance.
- Views: `claimable`, `balanceOf` (earned, claimed), `earnedInVersion`, `versionRevenue`, `projectRevenue`.
- Emits `RevenueClaimed(projectId, contributor, amount)`.

**Reentrancy safety:** claims follow checks-effects-interactions — the balance is checked, the claimed amount and totals
are updated and the event emitted *before* the ETH transfer — and `deposit`, `claim` and `claimAll` also carry a
`nonReentrant` guard. Tests use a malicious contributor contract that re-enters `claimAll` from its `receive` hook; the
re-entry is rejected and it is paid exactly once. If the transfer fails (recipient cannot accept ETH) the whole claim
reverts and the balance stays claimable.

### Security assumptions and known limitations

*Revenue-related:*

- **Rounding remainder policy.** Up to *(contributors − 1)* wei per deposit goes to the largest-share contributor. This
  is deterministic and documented but slightly favours that contributor.
- **Wallets that cannot receive ETH cannot claim.** Claims pay `msg.sender` only (there is no "claim to another
  address"), so a contract wallet that rejects ETH keeps its balance locked until it can accept ETH.
- **Lost keys lock earnings.** Unclaimed balances of a lost wallet cannot be recovered; there is no admin or rescue
  function (by design — no one can move contributors' funds).
- **Deposit gas grows with contributors** (one storage update per contributor, max 50). A 50-contributor deposit is
  tested to use under 3M gas.
- **Native ETH only.** No ERC-20 support yet. Anyone may deposit any non-zero amount to a project with an active
  agreement; deposits cannot be refunded.

*Agreement-related:*

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
- **Not audited.** Local Hardhat network only. Do not deploy with real funds or use it to hold real money.

## Not yet designed / implemented

- ERC-20 / stablecoin revenue
- Frontend flows for deposits, claims, creating proposals and voting
- Indexing / reading contract events in the UI
- Key loss / address rotation, proposal expiry, dispute resolution
- Target chain selection, audits and deployment process
