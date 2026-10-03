const toUnits = (raw, decimals) => Number(raw) / 10 ** decimals;

// Work out the real state of a task from the numbers, not just Gibwork's label.
function deriveState(task, rewarded) {
  if (task.status === 'refunded') return 'refunded';
  if (task.status === 'creating') return 'pending';
  if (task.isOpen) return 'open';
  if (rewarded > 0) return 'paid out';
  if (task.canRefund) return 'expired - refundable';
  return task.status;
}

export function toLedgerRow(task) {
  const { asset } = task;
  const funded = toUnits(asset.amount, asset.decimals);
  const rewarded = toUnits(asset.rewarded, asset.decimals);

  return {
    taskId: task.id,
    title: task.title,
    createdAt: task.createdAt,
    token: asset.symbol,
    mint: asset.mintAddress,
    funded,
    rewarded,
    unpaid: Number((funded - rewarded).toFixed(asset.decimals)),
    submissions: task.totalSubmissions,
    approved: task.approvedSubmissions,
    gibworkStatus: task.status,
    state: deriveState(task, rewarded),
  };
}