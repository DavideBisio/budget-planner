// Backup and restore (STOR-4) and clear all (STOR-3). A backup is one JSON file built by
// core/backup.js; restoring validates the whole file before anything is written, asks first, and
// writes all sections or none. The pieces are shared: the planner page shows them in a footer, the
// import page spreads them over its tabs (download on Output, load and clear on Import).
import { buildBackup, parseBackup } from '../core/backup.js';
import { h, uid, fill } from './dom.js';
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

/** Whether a text is a backup file (as opposed to, say, a settings file). */
export function isBackupText(text) {
  try {
    return JSON.parse(text)?.app === 'budget-planner';
  } catch {
    return false;
  }
}

/**
 * "Download backup" and the optional "Include the imported bank files". `current()` can return
 * sections that are newer than what is stored (the import page's live settings).
 */
export function backupDownload(current = () => ({})) {
  const filesId = uid('with-files');
  const includeFiles = h('input', { type: 'checkbox', id: filesId });
  const status = h('p', { class: 'hint', role: 'status' });

  function download() {
    const sections = { ...storedSections(), ...current() };
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

  const node = h(
    'div',
    {},
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
    status,
  );
  return { node };
}

/**
 * Restore a backup from its text. Returns the problems that refused it (nothing was changed), or
 * an empty list when the person declined; on success the page reloads.
 */
export function restoreBackup(text) {
  const result = parseBackup(text);
  if (result.problems.length > 0) return result.problems;
  const names = result.sections.map(s => s.name).join(', ');
  if (
    !window.confirm(
      `Restoring will replace your current ${names} with the ones in this file. Continue?`,
    )
  ) {
    return [];
  }
  if (!saveAll(result.sections)) {
    return [
      {
        path: '',
        message: 'The backup could not be written to this browser, so nothing was changed.',
      },
    ];
  }
  window.location.reload();
  return [];
}

/** The problems of a refused restore, as nodes. */
export function restoreProblems(problems) {
  return [
    h('p', {}, 'This backup cannot be restored, so nothing was changed:'),
    h(
      'ul',
      { class: 'plain' },
      problems.map(p => h('li', {}, p.path ? `${p.path}: ${p.message}` : p.message)),
    ),
  ];
}

/** "Clear all data", after a confirmation. */
export function clearAllButton(showNotice) {
  return h(
    'button',
    {
      class: 'btn danger',
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
  );
}

/** The planner page's footer: all of it in one card. */
export function mountBackup(footer, showNotice) {
  const restoreId = uid('restore');
  const problems = h('div', { role: 'alert', hidden: true });
  const showProblems = (...children) => {
    fill(problems, ...children);
    problems.hidden = children.length === 0;
  };
  const restoreInput = h('input', {
    type: 'file',
    id: restoreId,
    accept: 'application/json,.json',
    onchange: async () => {
      const [file] = restoreInput.files;
      restoreInput.value = '';
      if (!file) return;
      const refused = restoreBackup(await file.text());
      showProblems(...(refused.length ? restoreProblems(refused) : []));
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
      backupDownload().node,
      h(
        'div',
        { class: 'field' },
        h('label', { for: restoreId }, 'Restore from a backup file'),
        restoreInput,
      ),
      problems,
      clearAllButton(showNotice),
    ),
  );
}
