use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, Transfer, MintTo},
};

declare_id!("Ex9Jg3YVNSJhWN2thNbxn2nFvUNATj7czyNR44VTHYHc");

/// BlueCollar SONA token program.
///
/// Stage 1: airdrop registry and pending balance ledger only.
/// Stage 2: distributes SONA from the treasury to user claim accounts based on the
/// off-chain QES → SONA conversion finalized by the platform authority.
///
/// Design notes:
/// - Single mint owned by the program authority (treasury PDA).
/// - Per-user `ClaimAccount` records cumulative claimable lamports.
/// - The authority signs a `record_claim` instruction (off-chain QES → on-chain entitlement).
/// - Users call `claim` to mint/transfer SONA into their associated token account.
#[program]
pub mod sona {
    use super::*;

    /// Initialize the SONA mint + treasury PDA. Run once.
    pub fn initialize(ctx: Context<Initialize>, decimals: u8) -> Result<()> {
        let cfg = &mut ctx.accounts.config;
        cfg.authority = ctx.accounts.authority.key();
        cfg.mint = ctx.accounts.mint.key();
        cfg.total_distributed = 0;
        cfg.decimals = decimals;
        cfg.bump = ctx.bumps.config;
        Ok(())
    }

    /// Authority-only: record a pending claim for a user (e.g. from a QES snapshot).
    pub fn record_claim(ctx: Context<RecordClaim>, amount: u64) -> Result<()> {
        require!(amount > 0, SonaError::InvalidAmount);
        require_keys_eq!(ctx.accounts.authority.key(), ctx.accounts.config.authority, SonaError::Unauthorized);
        let claim = &mut ctx.accounts.claim;
        claim.user = ctx.accounts.user.key();
        claim.pending = claim.pending.checked_add(amount).ok_or(SonaError::Overflow)?;
        claim.bump = ctx.bumps.claim;
        Ok(())
    }

    /// User claims their pending SONA. Mints tokens into the user's associated token account.
    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        let claim = &mut ctx.accounts.claim;
        let amount = claim.pending;
        require!(amount > 0, SonaError::NothingToClaim);

        let seeds: &[&[u8]] = &[b"config", &[ctx.accounts.config.bump]];
        let signer = &[seeds];

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.user_ata.to_account_info(),
                    authority: ctx.accounts.config.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;

        claim.pending = 0;
        claim.claimed = claim.claimed.checked_add(amount).ok_or(SonaError::Overflow)?;
        let cfg = &mut ctx.accounts.config;
        cfg.total_distributed = cfg.total_distributed.checked_add(amount).ok_or(SonaError::Overflow)?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Config::SIZE,
        seeds = [b"config"], bump
    )]
    pub config: Account<'info, Config>,
    #[account(
        init,
        payer = authority,
        mint::decimals = 9,
        mint::authority = config,
    )]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct RecordClaim<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: pubkey only, used as seed.
    pub user: AccountInfo<'info>,
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + ClaimAccount::SIZE,
        seeds = [b"claim", user.key().as_ref()], bump
    )]
    pub claim: Account<'info, ClaimAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, address = config.mint)]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"claim", user.key().as_ref()],
        bump = claim.bump,
        has_one = user
    )]
    pub claim: Account<'info, ClaimAccount>,
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = mint,
        associated_token::authority = user,
    )]
    pub user_ata: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[account]
pub struct Config {
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub total_distributed: u64,
    pub decimals: u8,
    pub bump: u8,
}
impl Config { pub const SIZE: usize = 32 + 32 + 8 + 1 + 1; }

#[account]
pub struct ClaimAccount {
    pub user: Pubkey,
    pub pending: u64,
    pub claimed: u64,
    pub bump: u8,
}
impl ClaimAccount { pub const SIZE: usize = 32 + 8 + 8 + 1; }

#[error_code]
pub enum SonaError {
    #[msg("Unauthorized")] Unauthorized,
    #[msg("Invalid amount")] InvalidAmount,
    #[msg("Nothing to claim")] NothingToClaim,
    #[msg("Math overflow")] Overflow,
}
