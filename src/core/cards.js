/**
 * Planner cards (ENG-9), built from the output of `detectRecurring`.
 *
 * Every card has `flow` (signed cash movement in cents: money in positive, out negative) and
 * `amount` (the figure the planner shows). Income shows its flow; expenses and savings show the
 * flow with the sign reversed, so money put into savings is a positive saving and money taken
 * out of savings is a negative one (a withdrawal).
 */

const amountOf = (kind, flow) => (kind === 'income' ? flow : -flow || 0);

const card = (fields, flow) => ({ ...fields, flow, amount: amountOf(fields.kind, flow) });

/**
 * @param {{months: string[], recurring: object[], oneTime: object[]}} detected
 * @returns {{recurring: object[], oneTime: object[],
 *   totals: {byKind: {income: number, expense: number, saving: number},
 *     byCategory: {category: string, kind: string, amount: number}[], net: number}}}
 */
export function buildCards({ months, recurring, oneTime }) {
  const recurringCards = recurring.map(entry =>
    card(
      {
        id: entry.key,
        type: 'recurring',
        month: null,
        payee: entry.payee,
        category: entry.category,
        kind: entry.kind,
        perMonth: entry.perMonth,
        transactionIds: entry.transactions.map(t => t.id),
      },
      entry.monthly,
    ),
  );
  const oneTimeCards = oneTime.map(tx =>
    card(
      {
        id: tx.id,
        type: 'one-time',
        month: tx.date.slice(0, 7),
        date: tx.date,
        payee: tx.payee,
        category: tx.category,
        kind: tx.kind,
        transactionIds: [tx.id],
      },
      tx.amount,
    ),
  );

  // a recurring card happens in every month of the span
  const totals = { byKind: { income: 0, expense: 0, saving: 0 }, byCategory: [], net: 0 };
  const groups = new Map();
  for (const [c, times] of [
    ...recurringCards.map(c => [c, months.length]),
    ...oneTimeCards.map(c => [c, 1]),
  ]) {
    totals.byKind[c.kind] += c.amount * times;
    totals.net += c.flow * times;
    const key = `${c.category}|${c.kind}`;
    if (!groups.has(key)) {
      groups.set(key, { category: c.category, kind: c.kind, amount: 0 });
      totals.byCategory.push(groups.get(key));
    }
    groups.get(key).amount += c.amount * times;
  }
  return { recurring: recurringCards, oneTime: oneTimeCards, totals };
}
