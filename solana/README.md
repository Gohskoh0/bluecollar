# BlueCollar SONA Token — Solana Devnet

This directory contains the Anchor program that backs the SONA token economy.

## Stage rollout

- **Stage 1 (current production):** custodial Solana devnet wallets are provisioned for every user. We track pending balances and reward events off-chain. **No SONA is distributed yet.**
- **Stage 2 (after deploy + audit):** the platform authority calls `record_claim` for every eligible user (QES snapshot → SONA entitlement), users then call `claim` to mint SONA into their associated token account. This is the airdrop.

## Program layout

`programs/sona/src/lib.rs` defines three instructions:

1. `initialize(decimals)` — creates the mint and the authority PDA (`["config"]`). Run **once** by the deployer.
2. `record_claim(amount)` — authority-only. Records a per-user pending entitlement at PDA `["claim", user]`. Idempotent (accumulates).
3. `claim()` — user-signed. Mints `pending` SONA into the user's ATA and zeroes `pending`.

## Deploy to devnet

You need Rust, Solana CLI, and Anchor 0.30.1.

```bash
# 1. Install toolchain (first time)
sh -c "$(curl -sSfL https://release.solana.com/v1.18.17/install)"
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install 0.30.1 && avm use 0.30.1

# 2. Create / fund a devnet keypair
solana-keygen new --outfile ~/.config/solana/id.json
solana config set --url https://api.devnet.solana.com
solana airdrop 2

# 3. Build + deploy
cd solana
anchor build
anchor deploy --provider.cluster devnet

# 4. Copy the new program ID into:
#    - solana/Anchor.toml ([programs.devnet] sona = "...")
#    - solana/programs/sona/src/lib.rs (declare_id!("..."))
#    Then rebuild + redeploy once more so the on-chain binary matches.

# 5. Initialize the mint (one-time)
anchor run init
```

## Environment

The web app needs these secrets to drive the program:

| Env var | Purpose |
|--|--|
| `SOLANA_RPC_URL` | Defaults to `https://api.devnet.solana.com` |
| `WALLET_ENCRYPTION_KEY` | base64-encoded 32 bytes — AES-GCM key for custodial secret encryption |
| `SONA_PROGRAM_ID` | Deployed program ID |
| `SONA_AUTHORITY_SECRET` | base58-encoded authority keypair (used to call `record_claim`) |

`WALLET_ENCRYPTION_KEY` can be generated with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Stage 2 airdrop flow

1. Platform snapshots QES for every eligible user.
2. Backend job iterates users and calls `record_claim(authority, user_pubkey, amount)`.
3. Users see a "Claim SONA" button in their Monetization tab; clicking it signs `claim()` from the custodial wallet (or their connected wallet in future).
4. Mint authority is locked or transferred to a multisig after the initial distribution.
