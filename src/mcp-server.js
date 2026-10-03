/* MCP talks to the AI client over stdout, so nothing else may print there.
This silences dotenv's startup message.*/
process.env.DOTENV_CONFIG_QUIET = 'true';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';


// Always write exports inside the project's data folder, whatever folder the server was started from.
const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const round = (n) => Number(n.toFixed(6));
const sum = (rows, key) => round(rows.reduce((total, r) => total + r[key], 0));
const reply = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });
const fail = (err) => ({ isError: true, content: [{ type: 'text', text: `Error: ${err.message}` }] });

// Loaded lazily so the quiet setting above is applied first.
async function load() {
    const { buildLedger } = await import('./build.js');
    return buildLedger();
}

const server = new McpServer({ name: 'gibwork-ledger', version: '0.1.0' });

server.registerTool(
    'ledger_verify',
    {
        description:
            'List every Gibwork task this wallet created, with funded/refunded amounts, fees, and whether its on-chain Solana transactions reconcile.',
    },
    async () => {
        try {
            const rows = await load();
            return reply({
                tasksNeedingAttention: rows.filter((r) => r.check !== 'verified').length,
                tasks: rows,
            });
        } catch (err) {
            return fail(err);
        }
    }
);

server.registerTool(
    'ledger_summary',
    {
        description:
            'Totals across the wallet\'s Gibwork tasks (funded, paid to workers, refunded, fees, still locked), optionally for one month.',
        inputSchema: {
            month: z.string().regex(/^\d{4}-\d{2}$/).optional().describe('Only tasks created in this month, e.g. 2026-10'),
        },
    },
    async ({ month }) => {
        try {
            let rows = await load();
            if (month) rows = rows.filter((r) => r.createdAt.startsWith(month));
            return reply({
                month: month ?? 'all time',
                tasks: rows.length,
                fundedUsdc: sum(rows, 'funded'),
                paidToWorkersUsdc: sum(rows, 'rewarded'),
                refundedUsdc: sum(rows, 'refundedAmount'),
                feesKeptUsdc: sum(rows, 'fee'),
                stillLockedUsdc: sum(rows.filter((r) => r.state === 'open'), 'funded'),
                needAttention: rows.filter((r) => r.check !== 'verified').length,
            });
        } catch (err) {
            return fail(err);
        }
    }
);

server.registerTool(
    'ledger_export',
    {
        description: 'Write the full ledger to a CSV file inside the project\'s data folder.',
        inputSchema: {
            filename: z.string().optional().describe('File name, default ledger.csv'),
        },
    },
    async ({ filename }) => {
        try {
            const rows = await load();
            const cols = [
                'taskId', 'title', 'createdAt', 'token', 'funded', 'rewarded',
                'refundedAmount', 'fee', 'state', 'check', 'fundingTx', 'refundTx',
            ];
            const cell = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
            const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n');

            const name = basename(filename || 'ledger.csv'); // keep writes inside data/
            mkdirSync(DATA_DIR, { recursive: true });
            writeFileSync(join(DATA_DIR, name), csv);
            return reply({ wrote: join(DATA_DIR, name), rows: rows.length });
        } catch (err) {
            return fail(err);
        }
    }
);

await server.connect(new StdioServerTransport());