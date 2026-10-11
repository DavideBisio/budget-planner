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

// The footer holds the backup, restore and clear-all controls (STOR-3, STOR-4).
const footer = h('footer', { class: 'site-footer' });
document.querySelector('main')?.after(footer);
mountBackup(footer, text => {
  notice.textContent = text;
  notice.hidden = false;
});
