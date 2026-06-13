// Server-only Solana helpers for custodial wallets on devnet.
// IMPORTANT: only import this from .server files or inside server-fn handlers.
import { Connection, Keypair, PublicKey, clusterApiUrl, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs58 from "bs58";

const RPC = process.env.SOLANA_RPC_URL || clusterApiUrl("devnet");

export function getConnection() {
  return new Connection(RPC, "confirmed");
}

// AES-GCM symmetric encryption using WALLET_ENCRYPTION_KEY (base64, 32 bytes)
async function getKey(): Promise<CryptoKey> {
  const raw = process.env.WALLET_ENCRYPTION_KEY;
  if (!raw) throw new Error("WALLET_ENCRYPTION_KEY not set");
  const bytes = Buffer.from(raw, "base64");
  if (bytes.length !== 32) throw new Error("WALLET_ENCRYPTION_KEY must decode to 32 bytes");
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(secretKey: Uint8Array): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const buf = secretKey.buffer.slice(secretKey.byteOffset, secretKey.byteOffset + secretKey.byteLength) as ArrayBuffer;
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, buf);
  const out = new Uint8Array(iv.length + ct.byteLength);
  out.set(iv, 0); out.set(new Uint8Array(ct), iv.length);
  return Buffer.from(out).toString("base64");
}

export async function decryptSecret(payload: string): Promise<Uint8Array> {
  const key = await getKey();
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const ct = buf.subarray(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new Uint8Array(pt);
}

export function generateKeypair() {
  const kp = Keypair.generate();
  return {
    publicKey: kp.publicKey.toBase58(),
    secretKey: kp.secretKey, // 64 bytes
    secretBase58: bs58.encode(kp.secretKey),
  };
}

export async function airdropDevnet(pubkey: string, sol = 0.05): Promise<string | null> {
  try {
    const conn = getConnection();
    const sig = await conn.requestAirdrop(new PublicKey(pubkey), Math.floor(sol * LAMPORTS_PER_SOL));
    await conn.confirmTransaction(sig, "confirmed");
    return sig;
  } catch (e) {
    console.warn("devnet airdrop failed (rate limited?)", e);
    return null;
  }
}

export async function getBalance(pubkey: string): Promise<number> {
  try {
    const conn = getConnection();
    const lamports = await conn.getBalance(new PublicKey(pubkey));
    return lamports / LAMPORTS_PER_SOL;
  } catch {
    return 0;
  }
}
