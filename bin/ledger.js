#!/usr/bin/env node
import { Command } from 'commander';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { buildLedger } from '../src/build.js';

const round = (n) => Number(n.toFixed(6));
const sum = (rows, key) => round(rows.reduce((total, r) => total + r[key], 0));

const program = new Command();
program
  .name('ledger')
  .description('Audit trail for the Gibwork bounties your wallet created')
  .version('0.1.0');

program
  .command('verify')
  .description('Show every task and whether its on-chain transactions reconcile')
  .action(async () => {
    const rows = await buildLedger();
    console.table(rows, ['title', 'state', 'funded', 'refundedAmount', 'fee', 'check']);
    const bad = rows.filter((r) => r.check !== 'verified');
        console.log(
      bad.length ? `${bad.length} task(s) need attention.` : 'All tasks reconcile on-chain.'
    );
        const recoverable = rows.filter((r) => r.state === 'expired - refundable');
    if (recoverable.length) {
      console.log(
        `${recoverable.length} expired task(s) can be refunded: ${sum(recoverable, 'funded')} USDC recoverable.`
      );
    }
  });

program
  .command('summary')
  .description('Totals across your tasks, optionally for one month')
  .option('--month <yyyy-mm>', 'only tasks created in this month, e.g. 2026-10')
  .action(async (opts) => {
    let rows = await buildLedger();
    if (opts.month) rows = rows.filter((r) => r.createdAt.startsWith(opts.month));

    console.log(`Tasks:            ${rows.length}${opts.month ? ` (${opts.month})` : ''}`);
    console.log(`Funded:           ${sum(rows, 'funded')} USDC`);
    console.log(`Paid to workers:  ${sum(rows, 'rewarded')} USDC`);
    console.log(`Refunded:         ${sum(rows, 'refundedAmount')} USDC`);
    console.log(`Fees kept:        ${sum(rows, 'fee')} USDC`);
    console.log(
      `Still locked:     ${sum(rows.filter((r) => r.state === 'open'), 'funded')} USDC (open tasks)`
    );
    console.log(`Need attention:   ${rows.filter((r) => r.check !== 'verified').length}`);
  });

program
  .command('export')
  .description('Write the full ledger to a CSV file')
  .option('--out <path>', 'output file', 'data/ledger.csv')
  .action(async (opts) => {
    const rows = await buildLedger();
    const cols = [
      'taskId', 'title', 'createdAt', 'token', 'funded', 'rewarded',
      'refundedAmount', 'fee', 'state', 'check', 'fundingTx', 'refundTx',
    ];
    const cell = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
    const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n');

    mkdirSync(dirname(opts.out), { recursive: true });
    writeFileSync(opts.out, csv);
    console.log(`Wrote ${rows.length} rows to ${opts.out}`);
  });

program.parseAsync().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});