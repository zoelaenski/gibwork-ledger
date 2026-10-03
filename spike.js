import { createGibworkClient } from '@gibwork/sdk/node';

const gibwork = createGibworkClient({
  privateKey: process.env.SOLANA_PRIVATE_KEY,
});

const tasks = await gibwork.tasks.list();
console.log(JSON.stringify(tasks, null, 2));