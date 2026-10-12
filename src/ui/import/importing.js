// Step 2 (IMP-4): choose statement files, keep their raw text, and show what was imported.
import { summarizeImport } from '../../core/summary.js';
import { h, uid, fill } from '../dom.js';
import { formatCents } from '../format.js';

/** A name that is not used yet: "a.csv", then "a (2).csv", "a (3).csv". */
function uniqueName(name, taken) {
  if (!taken.has(name)) return name;
  const dot = name.lastIndexOf('.');
  const [stem, extension] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
  for (let n = 2; ; n += 1) {
    const candidate = `${stem} (${n})${extension}`;
    if (!taken.has(candidate)) return candidate;
  }
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const BALANCE = {
  ok: () => 'Balance matches',
  mismatch: f => `Balance is off by ${formatCents(Math.abs(f.difference))}`,
  unknown: () => 'No opening or closing balance in this file',
};

const RECONCILES = {
  yes: 'Yes',
  no: 'No',
  unknown: 'Unknown (no file has both an opening and a closing balance)',
};

function linkProblem(link) {
  if (link.status === 'gap') {
    return `Gap between ${link.from} and ${link.to}: the balances differ by ${formatCents(Math.abs(link.difference))}.`;
  }
  if (link.status === 'overlap') {
    const same = link.duplicates ? ` (${plural(link.duplicates, 'identical row')})` : '';
    return `${link.from} and ${link.to} cover some of the same dates${same}.`;
  }
  return null;
}

export function mountImporting(body, store, results) {
  const inputId = uid('files');

  async function add(fileList) {
    const added = [];
    const taken = new Set(store.get().sources.map(s => s.name));
    for (const file of fileList) {
      const name = uniqueName(file.name, taken);
      taken.add(name);
      added.push({ name, text: await file.text() });
    }
    if (added.length) store.set({ sources: [...store.get().sources, ...added] });
  }

  const list = h('ul', { class: 'file-list', 'aria-label': 'Imported files' });
  const dropzone = h(
    'div',
    { class: 'dropzone' },
    'Or drop statement files here',
    h('span', { class: 'hint' }, 'Files are read in this browser and are not uploaded.'),
  );
  dropzone.addEventListener('dragover', event => {
    event.preventDefault();
    dropzone.classList.add('over');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('over'));
  dropzone.addEventListener('drop', event => {
    event.preventDefault();
    dropzone.classList.remove('over');
    add(event.dataTransfer.files);
  });

  body.append(
    h(
      'div',
      { class: 'field' },
      h('label', { for: inputId }, 'Statement files'),
      h('input', {
        type: 'file',
        id: inputId,
        multiple: true,
        accept: '.csv,.txt,.tsv,text/csv,text/plain',
        onchange: async event => {
          await add(event.target.files);
          event.target.value = '';
        },
      }),
      h('span', { class: 'hint' }, 'Select one or more files.'),
    ),
    dropzone,
    list,
  );

  const summaryBody = results.card('import', 'Import summary');

  store.subscribe(({ sources, files }) => {
    if (!sources.length) {
      fill(list);
      results.show('import', false);
      return;
    }
    const summary = summarizeImport(files);
    const byFile = new Map(summary.files.map(f => [f.file, f]));

    fill(
      list,
      ...files.map((parsed, index) => {
        const line = byFile.get(parsed.file);
        const details = parsed.errors.length
          ? parsed.errors.map(e => h('span', { class: 'error' }, e.message))
          : [
              h('span', {}, plural(line.transactions, 'transaction')),
              h('span', {}, BALANCE[line.status](line)),
              parsed.warnings.length
                ? h('span', { class: 'hint' }, `${plural(parsed.warnings.length, 'row')} skipped`)
                : null,
            ];
        return h(
          'li',
          { class: 'file-item' },
          h('div', { class: 'file-info' }, h('strong', {}, parsed.file), ...details),
          h(
            'button',
            {
              class: 'btn secondary',
              type: 'button',
              'aria-label': `Remove ${parsed.file}`,
              onclick: () => store.set({ sources: sources.filter((_, i) => i !== index) }),
            },
            'Remove',
          ),
        );
      }),
    );

    results.show('import', true);
    const problems = summary.links.map(linkProblem).filter(Boolean);
    fill(
      summaryBody,
      h(
        'p',
        {},
        summary.transactions
          ? `${plural(summary.transactions, 'transaction')} over ${plural(summary.months, 'month')} (${summary.from} to ${summary.to})`
          : 'No transactions were read.',
      ),
      h(
        'ul',
        { class: 'plain' },
        h('li', {}, `Total income: ${formatCents(summary.income)}`),
        h('li', {}, `Total outcome: ${formatCents(summary.outcome)}`),
        h('li', {}, `Balance reconciles: ${RECONCILES[summary.reconciles]}`),
      ),
      problems.length
        ? h(
            'ul',
            { class: 'plain', role: 'alert' },
            problems.map(p => h('li', {}, p)),
          )
        : null,
    );
  });
}
