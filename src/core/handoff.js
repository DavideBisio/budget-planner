/**
 * The payload the import page hands to the planner (STOR-6, IMP-12): versioned, cards only,
 * with no transactions in it. The schema is documented in docs/ARCHITECTURE.md.
 */

export const HANDOFF_VERSION = 1;
const MODES = ['replace', 'merge'];

/** 53-bit string hash (cyrb53): a stable number for a text, with no way back to the text. */
function hash(text) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * The id a card has in the payload: stable, so importing the same data again gives the same ids
 * (merge relies on that), but opaque, because card ids are made from transaction text.
 */
export const cardId = id => hash(id).toString(36).padStart(8, '0');

const handoffCard = card => ({
  id: cardId(card.id),
  type: card.type,
  kind: card.kind,
  category: card.category,
  label: card.payee,
  amountCents: card.amount,
  ...(card.type === 'recurring' ? { perMonth: card.perMonth } : { month: card.month }),
});

/**
 * @param {{recurring: object[], oneTime: object[]}} cards from `buildCards`
 * @param {string[]} months the months (YYYY-MM) the data covers
 * @param {'replace' | 'merge'} mode
 */
export function buildHandoff({ recurring, oneTime }, months, mode) {
  if (!MODES.includes(mode)) throw new RangeError(`Unknown mode "${mode}": use replace or merge`);
  return {
    version: HANDOFF_VERSION,
    data: { mode, months: [...months], cards: [...recurring, ...oneTime].map(handoffCard) },
  };
}

const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** One sentence that says what sending the cards will do. */
export function describeHandoff({ recurring, oneTime }, mode) {
  const cards = `${count(recurring.length, 'recurring card')} and ${count(oneTime.length, 'one-time card')}`;
  return mode === 'replace'
    ? `The planner’s current cards will be replaced by ${cards}.`
    : `${cards} will be added to the planner. Cards already there stay.`;
}
