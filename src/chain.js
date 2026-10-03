import 'dotenv/config';
import { Connection, PublicKey } from '@solana/web3.js';

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

export function getConnection() {
  const url = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  return new Connection(url, 'confirmed');
}

// Net USDC change for wallet inside one transaction.
function usdcDelta(tx, owner) {
  const total = (balances = []) =>
    balances
      .filter((b) => b.owner === owner && b.mint === USDC_MINT)
      .reduce((sum, b) => sum + Number(b.uiTokenAmount.amount), 0);

  return (total(tx.meta.postTokenBalances) - total(tx.meta.preTokenBalances)) / 1e6;
}

// Every successful USDC movement (in or out) for wallet, newest first.
export async function fetchUsdcMovements(limit = 50) {
  const owner = process.env.WALLET_ADDRESS;
  if (!owner) throw new Error('WALLET_ADDRESS is missing. Add it to your .env file.');

  const conn = getConnection();
  const { value: accounts } = await conn.getParsedTokenAccountsByOwner(
    new PublicKey(owner),
    { mint: new PublicKey(USDC_MINT) }
  );

  const movements = [];
  for (const account of accounts) {
    const signatures = await conn.getSignaturesForAddress(account.pubkey, { limit });
    for (const sig of signatures) {
      if (sig.err) continue;
      const tx = await conn.getParsedTransaction(sig.signature, {
        maxSupportedTransactionVersion: 0,
      });
      if (!tx?.meta) continue;
      const amount = usdcDelta(tx, owner);
      if (amount === 0) continue;
      movements.push({
        signature: sig.signature,
        time: new Date(sig.blockTime * 1000).toISOString(),
        amount,
      });
    }
  }

  return movements.sort((a, b) => b.time.localeCompare(a.time));
}