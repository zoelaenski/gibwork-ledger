import 'dotenv/config';
import { createGibworkClient } from '@gibwork/sdk/node';

export function getClient() {
  if (!process.env.SOLANA_PRIVATE_KEY) {
    throw new Error('SOLANA_PRIVATE_KEY is missing. Add it to your .env file.');
  }
  return createGibworkClient({ privateKey: process.env.SOLANA_PRIVATE_KEY });
}

// Fetch all tasks created by this wallet (all pages).
export async function fetchTasks() {
  const gibwork = getClient();
  const res = await gibwork.tasks.list({ pageAll: true });
  return res.results;
}