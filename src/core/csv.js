/**
 * Minimal CSV reader (ENG-2): quoted fields with embedded delimiters, quotes and newlines,
 * BOM, CRLF. Returns rows of cells; blank lines are skipped.
 */
export function parseCsv(text, delim) {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  let started = false; // anything seen on the current line

  const endCell = () => {
    row.push(cell);
    cell = '';
  };
  const endRow = () => {
    endCell();
    if (started) rows.push(row);
    row = [];
    started = false;
  };

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch !== '"') cell += ch;
      else if (source[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = false;
    } else if (ch === '"') {
      quoted = true;
      started = true;
    } else if (ch === delim) {
      endCell();
      started = true;
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i++;
      endRow();
    } else {
      cell += ch;
      started = true;
    }
  }
  endRow();
  return rows;
}
