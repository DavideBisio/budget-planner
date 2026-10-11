// One shared popover. Markup:
//   <span class="popover" data-popover>
//     <button class="popover-trigger" aria-expanded="false" aria-controls="id">?</button>
//     <span class="popover-body" id="id" role="tooltip" hidden>Text</span>
//   </span>
// It opens on tap or click, on hover and on keyboard focus, and closes on Escape or an outside tap
// (GEN-1: nothing works only on hover).

function setOpen(root, open) {
  const trigger = root.querySelector('.popover-trigger');
  const body = root.querySelector('.popover-body');
  trigger.setAttribute('aria-expanded', String(open));
  body.hidden = !open;
}

const roots = new Set();
let listening = false;

/** Wire every popover under `scope` that is not wired yet; safe to call again after rendering. */
export function initPopovers(scope = document) {
  const fresh = [...scope.querySelectorAll('[data-popover]')].filter(root => !roots.has(root));

  for (const root of fresh) {
    roots.add(root);
    const trigger = root.querySelector('.popover-trigger');
    const isOpen = () => trigger.getAttribute('aria-expanded') === 'true';

    // Hover and focus open the popover before the click arrives, so a plain toggle would
    // close it again. Touch remembers the state before the gesture; a mouse click keeps it open
    // (it closes on mouseleave); the keyboard toggles.
    let stateBeforeTouch = null;
    trigger.addEventListener('pointerdown', event => {
      stateBeforeTouch = event.pointerType === 'touch' ? isOpen() : null;
      if (event.pointerType === 'mouse') stateBeforeTouch = false;
    });
    trigger.addEventListener('click', () => {
      setOpen(root, stateBeforeTouch === null ? !isOpen() : !stateBeforeTouch);
      stateBeforeTouch = null;
    });
    root.addEventListener('mouseenter', () => setOpen(root, true));
    root.addEventListener('mouseleave', () => setOpen(root, false));
    trigger.addEventListener('focus', () => setOpen(root, true));
    root.addEventListener('focusout', event => {
      if (!root.contains(event.relatedTarget)) setOpen(root, false);
    });
    root.addEventListener('keydown', event => {
      if (event.key === 'Escape') setOpen(root, false);
    });
  }

  if (listening) return;
  listening = true;
  document.addEventListener('pointerdown', event => {
    for (const root of roots) {
      if (!root.isConnected) roots.delete(root);
      else if (!root.contains(event.target)) setOpen(root, false);
    }
  });
}
