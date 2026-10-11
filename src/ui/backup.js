// Backup and restore (STOR-4) and clear all (STOR-3): the footer on every page. A backup is one
// JSON file built by core/backup.js; restoring validates the whole file before anything is
// written, asks first, and writes all sections or none.
import { buildBackup, parseBackup } from '../core/backup.js';
import { h, uid } from './dom.js';
import { downloadText } from './download.js';
import { clearAll, load, saveAll } from './storage.js';

const SECTIONS = ['config', 'overrides', 'planner', 'files'];

/** Everything that is stored and readable, by section name. */
function storedSections() {
  const sections = {};
  for (const name of SECTIONS) {
    const { status, data } = load(name);
    if (status === 'ok' || status === 'migrated') sections[name] = data;
  }
  return sections;
}

export function mountBackup(footer, showNotice) {
  const filesId = uid('with-files');
  const restoreId = uid('restore');
  const includeFiles = h('input', { type: 'checkbox', id: filesId });
  const status = h('p', { class: 'hint', role: 'status' });
  const problems = h('div', { role: 'alert', hidden: true });
  const showProblems = (...children) => {
    problems.replaceChildren(...children);
    problems.hidden = children.length === 0;
  };

  function download() {
    showProblems();
    const sections = storedSections();
    if (Object.keys(sections).length === 0) {
      status.textContent =
        'There is nothing stored in this browser yet, so there is nothing to back up.';
      return;
    }
    const backup = buildBackup(sections, { includeFiles: includeFiles.checked });
    downloadText('budget-planner-backup.json', JSON.stringify(backup, null, 2));
    status.textContent = includeFiles.checked
      ? 'Backup saved, including the imported bank files. Keep the file private.'
      : 'Backup saved. The imported bank files are not in it.';
  }

  async function restore(file) {
    status.textContent = '';
    showProblems();
    const result = parseBackup(await file.text());
    if (result.problems.length > 0) {
      showProblems(
        h('p', {}, 'This backup cannot be restored, so nothing was changed:'),
        h(
          'ul',
          { class: 'plain' },
          result.problems.map(p => h('li', {}, p.path ? `${p.path}: ${p.message}` : p.message)),
        ),
      );
      return;
    }
    const names = result.sections.map(s => s.name).join(', ');
    if (
      !window.confirm(
        `Restoring will replace your current ${names} with the ones in this file. Continue?`,
      )
    ) {
      return;
    }
    if (!saveAll(result.sections)) {
      showProblems(
        h('p', {}, 'The backup could not be written to this browser, so nothing was changed.'),
      );
      return;
    }
    window.location.reload();
  }

  const restoreInput = h('input', {
    type: 'file',
    id: restoreId,
    accept: 'application/json,.json',
    onchange: async () => {
      const [file] = restoreInput.files;
      if (file) await restore(file);
      restoreInput.value = '';
    },
  });

  footer.append(
    h(
      'section',
      { class: 'card data-card', 'aria-labelledby': 'data-title' },
      h('h2', { id: 'data-title' }, 'Your data'),
      h(
        'p',
        { class: 'hint' },
        'Everything stays in this browser. A backup file lets you move it or keep a copy.',
      ),
      h(
        'div',
        { class: 'pattern-controls' },
        h('button', { class: 'btn', type: 'button', onclick: download }, 'Download backup'),
        h(
          'div',
          { class: 'check' },
          includeFiles,
          h('label', { for: filesId }, 'Include the imported bank files'),
        ),
      ),
      h(
        'div',
        { class: 'field' },
        h('label', { for: restoreId }, 'Restore from a backup file'),
        restoreInput,
      ),
      status,
      problems,
      h(
        'button',
        {
          class: 'btn secondary',
          type: 'button',
          onclick: () => {
            const ok = window.confirm(
              'Clear all data stored in this browser: your plan, settings, manual changes and backups? This cannot be undone.',
            );
            if (!ok) return;
            if (clearAll() === false) {
              showNotice('This browser did not allow the data to be cleared.');
              return;
            }
            window.location.reload();
          },
        },
        'Clear all data',
      ),
    ),
  );
}
