/**
 * Recurring detection (ENG-7). Strict: transactions are grouped by direction, counterparty and
 * exact amount in cents. A group is recurring only if it occurs the same number of times in every
 * month of the data span (at least two months). No averaging, no tolerance. Everything else is a
 * one-time entry in its real month.
 */

const monthOf = date => date.slice(0, 7);

/** Every month (YYYY-MM) from the month of `from` to the month of `to`, inclusive. */
export function monthsBetween(from, to) {
  const months = [];
  let [year, month] = monthOf(from).split('-').map(Number);
  const last = monthOf(to);
  for (;;) {
    const label = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
    if (label > last) return months;
    months.push(label);
    if (++month > 12) [year, month] = [year + 1, 1];
  }
}

/**
 * Split classified transactions (with `payeeKey`) into recurring entries and one-time ones.
 * A recurring entry has `amount` (one occurrence), `perMonth` (occurrences per month) and
 * `monthly` (amount x perMonth).
 */
export function detectRecurring(transactions) {
  if (!transactions.length) return { months: [], recurring: [], oneTime: [] };

  const dates = transactions.map(t => t.date).sort();
  const months = monthsBetween(dates[0], dates.at(-1));

  const groups = new Map();
  for (const tx of transactions) {
    const direction = tx.amount > 0 ? 'in' : 'out';
    const key = `${direction}|${tx.payeeKey}|${tx.amount}`;
    if (!groups.has(key)) groups.set(key, { key, direction, transactions: [] });
    groups.get(key).transactions.push(tx);
  }

  const recurring = [];
  const recurringIds = new Set();
  for (const group of groups.values()) {
    const [first] = group.transactions;
    const perMonthCounts = months.map(
      month => group.transactions.filter(t => monthOf(t.date) === month).length,
    );
    const perMonth = perMonthCounts[0];
    const steady = months.length >= 2 && perMonth > 0 && perMonthCounts.every(c => c === perMonth);
    if (!steady) continue;
    for (const tx of group.transactions) recurringIds.add(tx);
    recurring.push({
      key: group.key,
      payee: first.payee,
      payeeKey: first.payeeKey,
      direction: group.direction,
      amount: first.amount,
      perMonth,
      monthly: first.amount * perMonth,
      category: first.category,
      kind: first.kind,
      transactions: group.transactions,
    });
  }
  return { months, recurring, oneTime: transactions.filter(tx => !recurringIds.has(tx)) };
}
