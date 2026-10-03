import { fetchTasks } from './gibwork.js';
import { toLedgerRow } from './ledger.js';
import { fetchUsdcMovements } from './chain.js';
import { reconcile } from './reconcile.js';

// The whole pipeline in one call. Used by both the CLI and the MCP server.
export async function buildLedger() {
  const tasks = await fetchTasks();
  const rows = tasks.map(toLedgerRow);
  const movements = await fetchUsdcMovements();
  return reconcile(rows, movements);
}
