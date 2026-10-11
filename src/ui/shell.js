import './styles/main.css';
import { initPopovers } from './popover.js';
import { clearAll, onStorageProblem } from './storage.js';
import { h } from './dom.js';

initPopovers();

// Storage problems are shown at the top of the page, as text, whatever the page was doing (STOR-1).
const MESSAGES = {
  full: 'This browser’s storage is full, so your latest changes were not saved. Free some space in your browser data and try again.',
  unavailable:
    'This browser does not allow saving (for example in a private window). Your changes are lost when you close the page.',
  newer:
    'Data saved on this device comes from a newer version of this app. It is left untouched and your changes are not saved.',
};

const notice = h('p', { class: 'notice', role: 'alert', hidden: true });
document.querySelector('.site-header')?.after(notice);
onStorageProblem(({ kind }) => {
  notice.textContent = MESSAGES[kind];
  notice.hidden = false;
});

// Clear all data (STOR-3): everything the app stored in this browser, after a confirmation.
const clear = h(
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
        notice.textContent = 'This browser did not allow the data to be cleared.';
        notice.hidden = false;
        return;
      }
      window.location.reload();
    },
  },
  'Clear all data',
);
document.querySelector('main')?.after(h('footer', { class: 'site-footer' }, clear));
