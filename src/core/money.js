/**
 * Read an amount typed by a person into integer cents (PLAN-3). Accepts a sign, "." or "," as the
 * decimal mark, and spaces, "," or "." as thousands separators when a decimal part follows.
 * Returns null for anything else, including more than two decimals: money is never rounded here.
 */
export function parseCents(text) {
  const clean = String(text).trim().replace(/\s/g, '');
  const match = /^([+-]?)(\d[\d.,]*|[.,]\d+)$/.exec(clean);
  if (!match) return null;
  const [, sign, digits] = match;

  // the last "." or "," starts the decimals when one or two digits follow it
  const mark = Math.max(digits.lastIndexOf('.'), digits.lastIndexOf(','));
  let whole = digits;
  let decimals = '';
  if (mark !== -1 && digits.length - mark - 1 <= 2) {
    whole = digits.slice(0, mark);
    decimals = digits.slice(mark + 1);
  }
  // what is left is plain digits or digits grouped in thousands, and groups need decimals after
  if (whole !== '' && !/^(\d+|\d{1,3}([.,]\d{3})+)$/.test(whole)) return null;
  if (/[.,]/.test(whole) && decimals === '') return null;
  const cents = Number(whole.replace(/[.,]/g, '') || '0') * 100 + Number(decimals.padEnd(2, '0'));
  return sign === '-' && cents !== 0 ? -cents : cents;
}
