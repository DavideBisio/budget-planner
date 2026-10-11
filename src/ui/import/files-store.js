// Persisting the imported files (STOR-1, ENG-10): only the raw text and the name are stored.
// Everything else is derived again from them, so a changed rule never meets stale results.
import { SCHEMAS } from '../../core/schemas.js';
import { load, save } from '../storage.js';

const valid = list =>
  Array.isArray(list) &&
  list.every(file => file && typeof file.name === 'string' && typeof file.text === 'string');

/** The files saved on an earlier visit, or none. */
export function loadFiles() {
  const { status, data } = load('files');
  return (status === 'ok' || status === 'migrated') && valid(data)
    ? data.map(({ name, text }) => ({ name, text }))
    : [];
}

/** Save the files whenever the list of sources is replaced. */
export function persistFiles(store) {
  let saved = store.get().sources;
  store.subscribe(({ sources }) => {
    if (sources === saved) return;
    saved = sources;
    save(
      'files',
      SCHEMAS.files.version,
      sources.map(({ name, text }) => ({ name, text })),
    );
  });
}
