const WINDOW_MS = 2 * 60 * 1000; // a task and its funding tx happen within 2 minutes
const round = (n) => Number(n.toFixed(6));
const ms = (iso) => new Date(iso).getTime();

export function reconcile(rows, movements) {
  const used = new Set();

  return rows.map((row) => {
    const created = ms(row.createdAt);

    // Funding: an outgoing transfer of the funded amount made when the task was created.
    const funding = movements
      .filter((m) => !used.has(m.signature) && round(m.amount) === -row.funded)
      .filter((m) => Math.abs(ms(m.time) - created) <= WINDOW_MS)
      .sort((a, b) => Math.abs(ms(a.time) - created) - Math.abs(ms(b.time) - created))[0];
    if (funding) used.add(funding.signature);

    // Refund: an incoming transfer after creation slightly under the funded amount.
    let refund = null;
    if (row.state === 'refunded' && funding) {
      refund =
        movements
          .filter((m) => !used.has(m.signature))
          .filter((m) => m.amount > 0 && m.amount <= row.funded && m.amount >= row.funded * 0.9)
          .filter((m) => ms(m.time) > created)
          .sort((a, b) => a.time.localeCompare(b.time))[0] ?? null;
      if (refund) used.add(refund.signature);
    }

    let check = 'verified';
    if (!funding) check = 'missing funding tx';
    else if (row.state === 'refunded' && !refund) check = 'missing refund tx';

    return {
      ...row,
      fundingTx: funding?.signature ?? null,
      refundTx: refund?.signature ?? null,
      refundedAmount: refund ? round(refund.amount) : 0,
      fee: refund ? round(row.funded - refund.amount) : 0,
      check,
    };
  });
}