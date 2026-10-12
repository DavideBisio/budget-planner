// Tiny DOM helpers. Text is always set as text, never as HTML.
export function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (name === 'class') node.className = value;
    else if (name.startsWith('on')) node.addEventListener(name.slice(2), value);
    else if (name in node && name !== 'list') node[name] = value;
    else node.setAttribute(name, value === true ? '' : value);
  }
  node.append(...kept(children));
  return node;
}

const kept = children => children.flat().filter(c => c !== null && c !== undefined && c !== false);

/** Replace the children of `node`. Unlike `replaceChildren`, it skips null, undefined and false. */
export function fill(node, ...children) {
  node.replaceChildren(...kept(children));
  return node;
}

let counter = 0;
/** A unique id for wiring labels and descriptions. */
export const uid = prefix => `${prefix}-${(counter += 1)}`;
