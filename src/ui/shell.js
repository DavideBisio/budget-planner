import './styles/main.css';
import { initPopovers } from './popover.js';
import { mountBackup } from './backup.js';
import { onStorageProblem } from './storage.js';
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

/** Show a message at the top of the page. */
export function showNotice(text) {
  notice.textContent = text;
  notice.hidden = false;
}

// The planner's footer holds the backup, restore and clear-all controls (STOR-3, STOR-4). The
// import page has its own place for them (a page that says `data-own-backup` on its main).
const main = document.querySelector('main');
if (main && !('ownBackup' in main.dataset)) {
  const footer = h('footer', { class: 'site-footer' });
  main.after(footer);
  mountBackup(footer, showNotice);
}
