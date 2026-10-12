// The settings file and persistence (IMP-13, IMP-14): export and import of the configuration, and
// saving the configuration and the manual changes in the browser between visits.
import { importConfig } from '../../core/config-file.js';
import { defaultConfig, migrateConfig, validateConfig } from '../../core/config.js';
import { SCHEMAS } from '../../core/schemas.js';
import { emptyOverrides, isOverrides } from '../../core/overrides.js';
import { clearAllButton, isBackupText, restoreBackup, restoreProblems } from '../backup.js';
import { h, uid, fill } from '../dom.js';
import { load, save } from '../storage.js';

const MESSAGES = {
  unreadable: 'The saved settings could not be read, so the defaults are shown.',
  newer:
    'The saved settings were written by a newer version of this app. They are left untouched and your changes will not be saved.',
  unavailable: 'This browser does not allow saving. Your changes are lost when you close the page.',
  saveFailed: 'Your changes could not be saved in this browser.',
};

/** The starting state: what was saved on an earlier visit, else the defaults, plus any notices. */
export function loadSettings() {
  const notices = [];
  let config = defaultConfig();
  const stored = load('config');
  if (stored.status === 'ok' || stored.status === 'migrated') {
    const candidate = migrateConfig(stored.data);
    if (validateConfig(candidate).length === 0) config = candidate;
    else notices.push(MESSAGES.unreadable);
  } else if (stored.status === 'newer') notices.push(MESSAGES.newer);
  else if (stored.status === 'unavailable') notices.push(MESSAGES.unavailable);
  else if (stored.status !== 'empty') notices.push(MESSAGES.unreadable);

  let overrides = emptyOverrides();
  const storedOverrides = load('overrides');
  if (
    (storedOverrides.status === 'ok' || storedOverrides.status === 'migrated') &&
    isOverrides(storedOverrides.data)
  ) {
    overrides = storedOverrides.data;
  }
  return { config, overrides, notices };
}

export function mountSettings(results, store, notices, showNotice) {
  const body = results.card('settings', 'Settings and backup');
  results.show('settings', true);
  const messages = [...notices];
  let imported = '';
  let problems = [];
  let restored = [];

  const status = h('div', { role: 'status' });
  const list = h('div', { role: 'alert' });
  const fileId = uid('settings');
  const render = () => {
    fill(status, ...[...messages, imported].filter(Boolean).map(text => h('p', {}, text)));
    fill(
      list,
      ...(problems.length
        ? [
            h(
              'ul',
              { class: 'plain' },
              problems.map(e => h('li', {}, e.path ? `${e.path}: ${e.message}` : e.message)),
            ),
          ]
        : []),
      ...restored,
    );
    list.hidden = problems.length === 0 && restored.length === 0;
  };

  body.append(
    h(
      'div',
      { class: 'field' },
      h('label', { for: fileId }, 'Load settings or a backup from a file'),
      h('input', {
        type: 'file',
        id: fileId,
        accept: '.json,application/json',
        onchange: async event => {
          const [file] = event.target.files;
          event.target.value = '';
          if (!file) return;
          const text = await file.text();
          problems = [];
          restored = [];
          imported = '';
          if (isBackupText(text)) {
            const refused = restoreBackup(text);
            restored = refused.length ? restoreProblems(refused) : [];
            render();
            return;
          }
          const result = importConfig(text);
          problems = result.errors;
          imported = result.config ? 'Settings imported.' : '';
          if (result.config) store.set({ config: result.config });
          render();
        },
      }),
      h(
        'span',
        { class: 'hint' },
        'A settings file holds your rules and settings only. A backup also holds the planner and your manual changes.',
      ),
    ),
    status,
    list,
    h('div', { class: 'field' }, clearAllButton(showNotice)),
  );
  render();

  // Persistence: save whenever the configuration or the manual changes are replaced.
  let saved = { config: store.get().config, overrides: store.get().overrides };
  store.subscribe(({ config, overrides }) => {
    const failed = [];
    if (config !== saved.config && !save('config', SCHEMAS.config.version, config))
      failed.push('config');
    if (overrides !== saved.overrides && !save('overrides', SCHEMAS.overrides.version, overrides)) {
      failed.push('overrides');
    }
    saved = { config, overrides };
    if (failed.length && !messages.some(m => m === MESSAGES.newer || m === MESSAGES.unavailable)) {
      if (!messages.includes(MESSAGES.saveFailed)) messages.push(MESSAGES.saveFailed);
      render();
    }
  });
}
