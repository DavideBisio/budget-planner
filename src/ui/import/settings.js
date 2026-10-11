// The settings file and persistence (IMP-13, IMP-14): export and import of the configuration, and
// saving the configuration and the manual changes in the browser between visits.
import { exportConfig, importConfig } from '../../core/config-file.js';
import { defaultConfig, migrateConfig, validateConfig } from '../../core/config.js';
import { SCHEMAS } from '../../core/schemas.js';
import { emptyOverrides } from '../../core/overrides.js';
import { h, uid } from '../dom.js';
import { downloadText } from '../download.js';
import { load, save } from '../storage.js';

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validOverrides = value =>
  isObject(value) && isObject(value.transactions) && isObject(value.payees);

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
    validOverrides(storedOverrides.data)
  ) {
    overrides = storedOverrides.data;
  }
  return { config, overrides, notices };
}

export function mountSettings(body, store, notices) {
  const messages = [...notices];
  let imported = '';
  let problems = [];

  const status = h('div', { role: 'status' });
  const list = h('ul', { class: 'plain', role: 'alert' });
  const fileId = uid('settings');
  const render = () => {
    status.replaceChildren(
      ...[...messages, imported].filter(Boolean).map(text => h('p', {}, text)),
    );
    list.replaceChildren(
      ...problems.map(e => h('li', {}, e.path ? `${e.path}: ${e.message}` : e.message)),
    );
    list.hidden = problems.length === 0;
  };

  body.append(
    h(
      'div',
      { class: 'pattern-controls' },
      h(
        'button',
        {
          class: 'btn secondary',
          type: 'button',
          onclick: () =>
            downloadText('budget-planner-settings.json', exportConfig(store.get().config)),
        },
        'Export settings',
      ),
    ),
    h(
      'div',
      { class: 'field' },
      h('label', { for: fileId }, 'Load settings from a file'),
      h('input', {
        type: 'file',
        id: fileId,
        accept: '.json,application/json',
        onchange: async event => {
          const [file] = event.target.files;
          event.target.value = '';
          if (!file) return;
          const result = importConfig(await file.text());
          problems = result.errors;
          imported = result.config ? 'Settings imported.' : '';
          if (result.config) store.set({ config: result.config });
          render();
        },
      }),
      h(
        'span',
        { class: 'hint' },
        'The file holds your rules and settings only, never your transactions.',
      ),
    ),
    status,
    list,
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
