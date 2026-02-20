# iSafe - Dynamic Multisig Wallet on IOTA

This repository contains an end-to-end implementation of a dApp that implements a [Safe](https://safe.global/)-like multisig wallet using the new **account abstraction** protocol feature of [IOTA](https://github.com/iotaledger/iota).

> [!WARNING]
> This dApp is intended solely for showcasing the capabilities of the new protocol feature and is by no means considered safe to use in any production environment.

Link to demo app: https://isafe-devnet.vercel.app/

## Table of Contents

- [Introduction](#introduction)
- [System Architecture](#system-architecture)
- [Repository Structure](#repository-structure)
- [Smart Contracts](#smart-contracts)
- [Backend Services](#backend-services)
- [Frontend (dApp)](#frontend-dapp)
- [User Manual](#user-manual)
- [Getting Started](#getting-started)
- [Configuration Reference](#configuration-reference)
- [Technology Stack](#technology-stack)

## Introduction

iSafe demonstrates **dynamic authentication** on IOTA — a mechanism that lets a shared on-chain Account object authenticate transactions through weighted multi-signature approval rather than a single private key. Key capabilities:

- **Shared custody accounts** with configurable member weights
- **Threshold-based approval** — transactions execute only when combined approver weight meets the threshold
- **Dynamic member management** — add/remove members and adjust weights or thresholds at any time
- **Authenticator rotation** — migrate to a new authentication scheme without creating a new account

## System Architecture

The system is composed of four main components that work together:

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Frontend dApp (Next.js)                     │
│   Create Account  |  Dashboard  |  Transactions  |  Settings        │
│                              │                                       │
│              React Hooks & Providers (@iota/dapp-kit)                │
└──────────────────────────────┼───────────────────────────────────────┘
                               │
          ┌────────────────────┼──────────────────────┐
          ▼                    ▼                       ▼
┌──────────────────┐ ┌──────────────────┐  ┌──────────────────┐
│  IOTA Wallet SDK │ │  iSafe Indexer   │  │   TX Service     │
│  (sign & submit) │ │  (Rust/Axum)     │  │  (Rust/Axum)     │
│                  │ │  :3030           │  │  :3031           │
└────────┬─────────┘ └────────┬─────────┘  └────────┬─────────┘
         │                    │                      │
         ▼                    ▼                      ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        IOTA Blockchain                               │
│   iSafe Move Smart Contracts                                         │
│   account.move | members.move | transactions.move | dynamic_auth.move│
│                                                                      │
│   Emitted Events ──▶ Indexed by iSafe Indexer                        │
└──────────────────────────────────────────────────────────────────────┘
```

**Data flow summary:**

1. The **frontend** builds transactions and sends them to the **IOTA blockchain** via the wallet SDK.
2. The **smart contracts** validate operations and emit events (account created, transaction proposed, etc.).
3. The **indexer** reads blockchain checkpoints, deserialises BCS-encoded events, and stores them in SQLite for fast querying.
4. The **TX service** stores raw transaction bytes off-chain so other members can retrieve and approve/execute them.
5. The frontend queries both backend services to display account state, pending transactions, and history.

For a deeper architectural dive, see [architecture.md](architecture.md).

## Repository Structure

```
dynamic-account-demo/
├── contracts/isafe/       # Move smart contracts (account abstraction logic)
│   ├── sources/           # account.move, members.move, transactions.move, dynamic_auth.move
│   └── tests/             # Move unit tests
├── dapp/                  # Next.js frontend application
│   ├── app/               # App router pages (landing, create, dashboard, settings, etc.)
│   ├── components/        # React components and dialog flows
│   ├── hooks/             # Custom React hooks for data fetching
│   └── config/            # Environment and network configuration
├── indexer/               # Rust blockchain event indexer service
│   ├── src/               # Axum REST API + checkpoint processing workers
│   └── migrations/        # Diesel SQLite migrations
├── tx-service/            # Rust transaction storage service
│   ├── src/               # Axum REST API + transaction management
│   └── migrations/        # Diesel SQLite migrations
├── docker/                # Docker Compose orchestration
│   └── docker-compose.yml # Indexer + TX Service containers
├── scripts/               # Rust utility scripts (transaction helpers)
└── architecture.md        # Detailed architecture documentation
```

## Smart Contracts

The on-chain logic lives in four Move modules under `contracts/isafe/sources/`:

| Module | Purpose |
|--------|---------|
| `account.move` | Base `Account` object — creation (hot-potato ticket pattern), deletion, authenticator rotation, dynamic field interface |
| `members.move` | `Members` / `Member` collection — add, remove, update weight, query by address |
| `transactions.move` | `Transactions` / `Transaction` tracking — propose, approve, remove, digest validation |
| `dynamic_auth.move` | Core orchestrator — `#[authenticator]` function, account builder, event emission, entry functions |

### Key Concepts

- **Account object** — a shared on-chain object (`Account { id, allowed_authenticators }`) that stores all account data as dynamic fields (members, threshold, transactions, guardian).
- **Weighted members** — each member has an address and a weight (voting power). Total member weight must always be >= threshold.
- **Threshold approval** — a transaction can be executed when the sum of approving members' weights meets or exceeds the threshold.
- **Dynamic fields** — members, threshold, pending transactions, and guardian are stored as dynamic fields on the Account UID, managed through authorised app keys.
- **Hot-potato pattern** — `AccountTicket` ensures account creation and authenticator attachment happen atomically in a single transaction.

### Entry Functions

| Function | Description |
|----------|-------------|
| `create_account(members, weights, threshold, package_metadata)` | Create a new multi-sig account |
| `propose_transaction(account, digest)` | Propose a transaction for member approval |
| `approve_transaction(account, digest)` | Add your approval vote to a pending transaction |
| `remove_transaction(account, digest)` | Remove a transaction (requires account-level approval) |
| `remove_current_transaction(account)` | Remove the currently executing transaction from state |
| `add_member(account, addr, weight)` | Add a new member (account-initiated) |
| `remove_member(account, addr)` | Remove a member (validates threshold still achievable) |
| `update_member_weight(account, addr, new_weight)` | Change a member's voting weight |
| `set_threshold(account, new_threshold)` | Change the approval threshold |
| `set_guardian(account, guardian)` | Set or update the account guardian |
| `destroy_account_data(account)` | Remove all dynamic auth data (for migration) |

### Events

`AccountCreatedEvent` · `AccountRotatedEvent` · `MemberAddedEvent` · `MemberRemovedEvent` · `MemberWeightUpdatedEvent` · `ThresholdChangedEvent` · `GuardianChangedEvent` · `TransactionProposedEvent` · `TransactionApprovedEvent` · `TransactionApprovalThresholdReachedEvent` · `TransactionExecutedEvent` · `TransactionRemovedEvent`

## Backend Services

### Indexer (`indexer/`)

Processes blockchain checkpoints to index iSafe events and exposes a queryable REST API for account state.

**API Endpoints** (port 3030):

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/accounts/{member_address}` | GET | Get all iSafe accounts for a member address |
| `/transactions/{account_address}` | GET | Get transaction summaries with approval status |
| `/events/{account_address}` | GET | Get all events for an account |

**Database Schema (SQLite):**

| Table | Key Columns |
|-------|-------------|
| `accounts` | `account_address` PK, `threshold`, `authenticator`, `created_at` |
| `members` | `id` PK, `account_address` FK, `member_address`, `weight`, `added_at` |
| `transactions` | `transaction_digest` PK, `account_address` PK, `proposer_address`, `status`, `created_at` |
| `approvals` | `transaction_digest` PK, `approver_address` PK, `account_address`, `approver_weight`, `approved_at` |
| `events` | `id` PK, `account_address`, `firing_tx_digest`, `event_type`, `content`, `timestamp` |

**How it works:** Reads checkpoints sequentially from the IOTA node, filters events by the iSafe package address, deserialises BCS event data, updates the database, and serves current state via REST.

### TX Service (`tx-service/`)

Stores and retrieves raw transaction bytes for the multi-signature workflow. When a member proposes a transaction, the bytes are stored here so other members can retrieve them for approval and execution.

**API Endpoints** (port 3031):

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/transaction/{tx_digest}` | GET | Retrieve a stored transaction by digest |
| `/add_transaction` | POST | Store a new transaction (`{tx_bytes, description}`) |
| `/derive_auth_signature/{address}` | GET | Derive Move authenticator for shared objects |

**Database Schema (SQLite):**

| Table | Key Columns |
|-------|-------------|
| `transactions` | `digest` PK, `sender`, `added_at`, `tx_data`, `description` |

## Frontend (dApp)

### Tech Stack

- **Next.js 16** with React 19 and the App Router
- **TypeScript** with strict mode
- **Tailwind CSS** for styling
- **@iota/dapp-kit** for wallet connection and transaction signing
- **@tanstack/react-query** for server state management
- **motion** (Framer Motion) for animations

### Page Routes

| Route | Purpose |
|-------|---------|
| `/` | Landing page — feature overview and "Get Started" |
| `/create` | 3-step account creation wizard (members, threshold, review & create) |
| `/[account]` | Account dashboard — balance, members, recent activity |
| `/[account]/transactions` | Transaction management — Proposed / Approved / Executed / Rejected tabs |
| `/[account]/settings` | Member and threshold management |
| `/address-book` | Local address book for naming addresses |

### Key Components

| Component | Purpose |
|-----------|---------|
| `AccountOverView` | Dashboard header with balance and account info |
| `Members` | Member list with weights and management controls |
| `Threshold` | Threshold display and edit |
| `ProposedTransactions` | List of pending transaction proposals |
| `ApprovedTransactions` | Transactions that met threshold, ready to execute |
| `ExecutedTransactions` | Historical executed transactions |
| `AccountActivity` | Event timeline for the account |
| `ApprovalProgressBar` | Visual indicator of approval progress vs threshold |
| `AccountSelector` | Switch between multiple iSafe accounts |
| `ConnectionGuard` | Ensures wallet is connected before showing content |

### Dialog Flows

| Dialog | Purpose |
|--------|---------|
| `ProposeTransactionDialog` | Build and submit a transaction proposal |
| `ApproveTransactionDialog` | Sign an approval for a pending transaction |
| `ExecuteTransactionDialog` | Execute a fully-approved transaction on-chain |
| `CancelTransactionDialog` | Cancel a single pending transaction |
| `BatchCancelTransactionDialog` | Cancel multiple transactions at once |
| `ExecuteSettingChangesDialog` | Apply member/threshold changes |
| `SendIotaDialog` | Propose an IOTA token transfer |
| `DeleteAccountDialog` | Permanently delete the account |

### Custom Hooks

| Hook | Data Source | Purpose |
|------|-------------|---------|
| `useGetMembers` | RPC (Move view) | Fetch account members and weights |
| `useGetThreshold` | RPC (Move view) | Fetch approval threshold |
| `useGetAccountTransactions` | Indexer API | Fetch transaction list with approval status |
| `useGetAccountEvents` | Indexer API | Fetch event history |
| `useGetAccountsForAddress` | Indexer API | List all accounts for a wallet address |
| `useGetAccountBalance` | RPC | Fetch account IOTA balance |
| `useGetAccountObject` | RPC | Fetch raw account object |
| `useGetTransactionDetails` | TX Service | Fetch stored transaction bytes |
| `useSimulateTransactions` | RPC | Dry-run transactions before execution |
| `useGetAllowedAuthenticators` | RPC | Query allowed authenticator list |
| `useAddressBook` | Local storage | Manage address book entries |
| `useSeenTransactions` | Local storage | Track which transactions the user has seen |

## User Manual

### 1. Connect Your Wallet

Open the dApp and click **Connect Wallet** in the top navigation bar. Select your IOTA-compatible wallet (e.g., IOTA Wallet browser extension). The dApp requires a connected wallet for all operations.

### 2. Create an Account

Navigate to **Create Account** (from the landing page or the navbar). The creation wizard has three steps:

1. **Add Members** — Enter wallet addresses and assign a weight (voting power) to each member. You can add yourself and other participants. Weights determine how much each member's approval counts toward the threshold.
2. **Set Threshold** — Choose the minimum combined weight required to approve transactions. The threshold must be between 1 and the total weight of all members.
3. **Review & Create** — Verify the member list and threshold, then sign the creation transaction with your wallet. The account is created on-chain as a shared object.

### 3. Account Dashboard

After creation, you'll land on the account dashboard (`/[account]`), which shows:

- **Balance** — The IOTA balance held by the account
- **Members** — All members with their addresses and weights
- **Recent Activity** — A timeline of events (member changes, transaction proposals, approvals, executions)

Use the **Account Selector** in the sidebar to switch between accounts if you're a member of multiple iSafe accounts.

### 4. Propose a Transaction

Go to the **Transactions** tab and click **Send IOTA** (or propose a custom transaction):

1. Enter the recipient address and amount.
2. The dApp builds a Programmable Transaction Block (PTB), serialises it, and stores the bytes in the TX Service.
3. The transaction digest is registered on-chain via `propose_transaction`, and your approval is automatically counted.
4. If your weight alone meets the threshold, the transaction is immediately ready to execute.

### 5. Approve a Transaction

On the **Transactions** tab under **Proposed**, you'll see pending transactions. Click **Approve** on a transaction to:

1. Review the transaction details (recipient, amount, etc.).
2. Sign and submit an approval transaction on-chain.
3. Your weight is added to the approval total. When the total meets the threshold, the transaction moves to the **Approved** tab.

### 6. Execute an Approved Transaction

Once a transaction reaches the approval threshold, any member can execute it:

1. Go to the **Approved** tab.
2. Click **Execute** on the transaction.
3. The dApp retrieves the original transaction bytes from the TX Service.
4. You sign and submit the execution transaction — the on-chain authenticator verifies the approval threshold is met and the transaction executes.
5. The transaction moves to the **Executed** tab.

### 7. Cancel Transactions

- **Single cancel** — On any pending or approved transaction, click **Cancel**. This proposes a cancellation that itself requires threshold approval from members.
- **Batch cancel** — Select multiple transactions and cancel them together. This creates a single PTB that removes all selected transactions from the account.

### 8. Manage Settings

Navigate to the **Settings** tab to modify the account configuration:

- **Add a member** — Enter an address and weight for the new member.
- **Remove a member** — Remove an existing member (the system validates that the remaining total weight still meets the threshold).
- **Update weight** — Change a member's voting power.
- **Change threshold** — Adjust the minimum approval weight required.

All settings changes are themselves transactions that require threshold approval — they go through the same propose → approve → execute flow.

### 9. Delete an Account

On the **Settings** page, you can initiate account deletion:

1. Choose a **beneficiary address** to receive any remaining IOTA balance.
2. The deletion transaction transfers assets to the beneficiary, removes all pending transactions, cleans up dynamic fields, detaches the authenticator, and destroys the account object.
3. This is irreversible — the account and all its on-chain data are permanently deleted.

### 10. Address Book

Navigate to the **Address Book** page to manage saved addresses:

- Add frequently used addresses with custom labels.
- Addresses from the book are shown with their labels throughout the dApp for easier identification.
- Data is stored in your browser's local storage.

## Getting Started

### Prerequisites

- **Node.js** >= 20 and **pnpm** (for the frontend)
- **Rust** (latest stable, for backend services and scripts)
- **IOTA CLI** (for smart contract deployment)
- **Docker & Docker Compose** (for running backend services)
- Access to an **IOTA node** (local, devnet, testnet, or mainnet)

### 1. Start a Local Network

```bash
# Start an IOTA localnet (includes a full node on port 9000 and a faucet)
iota start --with-faucet

# In a separate terminal, get some test tokens
iota client faucet
```

> [!TIP]
> If you prefer to use devnet or testnet instead, skip this step and adjust the network URLs in the backend and frontend configuration accordingly.

### 2. Deploy the Smart Contracts

```bash
cd contracts/isafe

# For localnet:
iota client publish --gas-budget 100000000

# Note the package ID and package metadata object ID from the output
```

### 3. Start the Backend Services

```bash
cd docker

# Set the package address from step 1
export ISAFE_PACKAGE_ADDRESS=0x<your-package-id>

# Build and start indexer + tx-service
docker compose up --build -d
```

The services will be available at:
- Indexer: `http://localhost:3030`
- TX Service: `http://localhost:3031`

> [!TIP]
> Alternatively, you may build & run both the indexer and tx-service from source. The default parameters assume localnet configuration.

### 4. Configure and Start the Frontend

```bash
cd dapp
pnpm install
```

Set the environment variables (create a `.env.local`):

```bash
NEXT_PUBLIC_ISAFE_DAPP_DEFAULT_NETWORK=localnet

NEXT_PUBLIC_ISAFE_DAPP_CONFIG='{"localnet":{"network":"localnet","baseUrl":"http://localhost:9000","isafeIndexerUrl":"http://localhost:3030","txServiceUrl":"http://localhost:3031","packageId":"0x<your-package-id>","packageMetadataId":"0x<your-metadata-id>"}}'
```

Start the development server:

```bash
pnpm dev
```

The dApp will be available at `http://localhost:3000`.

### Network Configuration

The docker-compose.yml includes commented URLs for each network:

| Network | Node URL | Checkpoint URL |
|---------|----------|----------------|
| Localnet | `http://host.docker.internal:9000` | `http://host.docker.internal:9000` |
| Devnet | `https://api.devnet.iota.cafe` | `https://checkpoints.devnet.iota.cafe` |
| Testnet | `https://api.testnet.iota.cafe` | `https://checkpoints.testnet.iota.cafe` |
| Mainnet | `https://api.mainnet.iota.cafe` | `https://checkpoints.mainnet.iota.cafe` |

## Configuration Reference

### Environment Variables

| Variable | Component | Description |
|----------|-----------|-------------|
| `ISAFE_PACKAGE_ADDRESS` | Indexer | On-chain package address to filter events |
| `RUST_LOG` | Indexer, TX Service | Log level configuration |
| `NEXT_PUBLIC_ISAFE_DAPP_CONFIG` | Frontend | JSON config with network endpoints and package IDs |
| `NEXT_PUBLIC_ISAFE_DAPP_DEFAULT_NETWORK` | Frontend | Default network key (e.g., `localnet`, `devnet`) |

### Frontend Config Schema

The `NEXT_PUBLIC_ISAFE_DAPP_CONFIG` JSON must conform to this schema (per network):

| Field | Type | Description |
|-------|------|-------------|
| `network` | `localnet \| devnet \| testnet \| mainnet` | Network identifier |
| `baseUrl` | `string` | IOTA RPC node URL |
| `isafeIndexerUrl` | `string` | Indexer API base URL |
| `txServiceUrl` | `string` | TX Service API base URL |
| `packageId` | `string` | Deployed iSafe package object ID |
| `packageMetadataId` | `string` | Package metadata object ID (for authenticator creation) |

### Service Ports

| Component | Default Port | Database |
|-----------|-------------|----------|
| Frontend | 3000 | N/A |
| Indexer | 3030 | SQLite (`/data/isafe.db`) |
| TX Service | 3031 | SQLite (local) |
| IOTA Node | 9000 | External dependency |

## Technology Stack

| Component | Technologies |
|-----------|-------------|
| Smart Contracts | Move language, IOTA framework (dynamic authentication, dynamic fields) |
| Indexer | Rust, Tokio, Axum, Diesel ORM, SQLite, iota-data-ingestion-core, Prometheus |
| TX Service | Rust, Tokio, Axum, Diesel ORM, SQLite, IOTA SDK, fastcrypto |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS, @iota/dapp-kit, @iota/iota-sdk, @tanstack/react-query, motion, zod |
| Infrastructure | Docker, Docker Compose |
| IOTA SDK | v1.16.1-beta |
