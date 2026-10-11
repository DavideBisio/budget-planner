/** Integer cents as a plain two-decimal amount, for example -1990 becomes "-19.90". Locale: #46. */
export function formatCents(cents) {
  const abs = Math.abs(cents);
  const text = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
  return cents < 0 ? `-${text}` : text;
}
