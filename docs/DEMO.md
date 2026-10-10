# CoVerse demo walkthrough (local test network)

A step-by-step script for demonstrating CoVerse end to end. Everything runs on your machine with Hardhat's local
chain and **test ETH only**. Allow ~15 minutes.

## 0. One-time preparation

1. Install Node.js 20+ and the MetaMask extension in a desktop browser. Create a **separate browser profile or MetaMask
   profile for testing** — do not mix test keys with a wallet that holds real money.
2. In the repository root: `npm install`.

## 1. Start the blockchain, deploy, start the app

Open three terminals in the repository root:

| Terminal | Command | Leave running? |
| --- | --- | --- |
| 1 | `npm run contracts:node` | Yes — this is the local blockchain |
| 2 | `npm run contracts:deploy` | No — exits after printing the contract address |
| 3 | `npm run dev` | Yes — web app at http://localhost:5173 |

(If the compiler download is blocked, prefix terminal 1 and 2 commands with `HARDHAT_USE_SOLCJS=true`.)

## 2. Prepare MetaMask

1. From terminal 1's output, import **four** test accounts into MetaMask (account menu → *Add account or hardware wallet*
   → *Import account* → paste the private key). Rename them for clarity:
   - Account #1 → **Alice** (creator & contributor)
   - Account #2 → **Bob** (contributor)
   - Account #3 → **Carol** (joins later)
   - Account #4 → **Payer** (a distributor sending revenue)
2. Open http://localhost:5173, click **Connect wallet**, approve in MetaMask.
3. In the **Live workspace**, click **Switch to Hardhat Local** and approve adding/switching the network.
   The status strip shows `Hardhat Local (chain 31337)`, the contract address and your test-ETH balance.

> Tip: copy each account's address from MetaMask before you start — you'll paste Bob's and Carol's addresses into forms.

## 3. Demonstrate the agreement lifecycle

**a. Create a project (as Alice).**
Fill in a title and content type. Row 1 is pre-filled with Alice's address — set it to **60**%. Click *Add contributor*,
paste **Bob**'s address, **40**%. Click *Create project & propose v1* and confirm in MetaMask.
Point out the transaction states: *confirm in MetaMask* → *pending on-chain* → *confirmed*.

**b. Show that nothing is binding yet.** The project says *awaiting approval*; Proposal #1 lists the **required
approvals** — Alice and Bob — both *Not voted*. These are read from the contract, not from the UI.

**c. Alice approves.** Click *Approve with my wallet*. The card shows *1 of 2*; there is **no Activate button** —
the contract requires every listed contributor.

**d. Switch MetaMask to Bob, approve, then activate.** After Bob's approval *Activate version 1* appears (anyone may
activate once all approvals are on-chain). Activate it — **Version 1** appears in *Agreement history*.

## 4. Demonstrate revenue

**a. Deposit (as Payer).** Switch MetaMask to Payer. In *Deposit revenue*, enter `1` and click *Deposit*. The text above
the field shows which version and split the deposit goes to; the app sends that version number, and the contract
rejects the deposit if the agreement changed in the meantime.

**b. Claim (as Alice).** Switch to Alice. *Your earnings* shows **0.6 ETH** claimable (60%). Click *Claim all* — the
wallet balance in the status strip rises. Try *Claim amount* with more than is claimable to show the error.

## 5. Demonstrate amendments, rejection and history

**a. Propose a change (as Alice).** *Propose a change* → replace Bob's address with **Carol**'s (keep 40%) → *Submit
proposal*. The card shows the diff (*added*, *removed (was 40%)*) and **three** required approvers: Alice, Bob (being
removed) and Carol (being added).

**b. Rejection (as Bob).** Switch to Bob and click *Reject*. The proposal becomes **Rejected** and Version 1 stays
active — a pending or rejected proposal never replaces the agreement.

**c. Unanimous approval.** As Alice, propose the same change again. Approve it as Alice, Bob and Carol (switching
accounts each time), then *Activate version 2*. *Agreement history* now shows **Version 2 (Active)** and
**Version 1 (Historical)** — history is never overwritten.

**d. Removed contributor keeps earned revenue.** As Payer, deposit `2`. Switch to Bob: he still has **0.4 ETH**
claimable from the version-1 deposit and nothing from version 2. Switch to Carol: **0.8 ETH** from version 2.
Bob no longer sees *Propose a change*.

## 6. Error handling to show

| Try this | What the app says |
| --- | --- |
| Reject a MetaMask confirmation popup | "You rejected the request in MetaMask. Nothing was sent." |
| Switch MetaMask to another network | The workspace shows *Wrong network* with a *Switch to Hardhat Local* button |
| Deposit more ETH than the wallet holds | "Not enough test ETH …" (checked before MetaMask opens) |
| Approve as an account that isn't required | No approve button; the card explains the wallet isn't a required approver |
| Restart terminal 1 without redeploying | "Contract not found on this chain … run `npm run contracts:deploy` again" |

## Resetting

Stop terminal 1 and start it again, re-run `npm run contracts:deploy`, reload the page, and in MetaMask use
**Settings → Advanced → Clear activity tab data** for each test account.

## What is demo data

Below the Live workspace, the **Dashboard design preview** (stats, earnings chart, demo projects, activity) is sample
data, tagged *Demo data*. Only the Live workspace reflects the blockchain.
