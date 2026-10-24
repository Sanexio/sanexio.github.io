import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = (await readFile('public/scripts/organ-loader.js', 'utf8'))
  .replace("import('./organ-viewer.js')", 'getViewerModule()');

async function scenario({ reduce = false, saveData = false, fail = false } = {}) {
  const timers = new Map();
  const idles = new Map();
  const listeners = {};
  let intersection;
  let loads = 0;
  let sequence = 0;
  let active = false;
  const button = { addEventListener(event, fn) { listeners[event] = fn; } };
  const status = {};
  const element = { querySelector(selector) { return selector === '[data-load]' ? button : status; } };
  const motion = { matches: reduce, addEventListener(_, fn) { listeners.motion = fn; } };
  const document = { hidden: false, querySelectorAll() { return [element]; }, addEventListener(_, fn) { listeners.visibility = fn; } };
  const context = {
    document, navigator: { connection: { saveData } }, matchMedia: () => motion,
    setTimeout(fn) { timers.set(++sequence, fn); return sequence; },
    clearTimeout(id) { timers.delete(id); },
    requestIdleCallback(fn) { idles.set(++sequence, fn); return sequence; },
    cancelIdleCallback(id) { idles.delete(id); },
    IntersectionObserver: class { constructor(fn) { intersection = fn; } observe() {} },
    async getViewerModule() { loads++; if (fail) throw Error('offline'); return { async createViewer() { return { setVisible(value) { active = value; } }; } }; },
  };
  context.window = context;
  vm.runInNewContext(source, context);
  const flush = async () => { for (const [id, fn] of timers) { timers.delete(id); fn(); } for (const [id, fn] of idles) { idles.delete(id); fn(); } await new Promise(resolve => setImmediate(resolve)); };
  return { flush, show(value) { intersection([{ isIntersecting: value }]); }, click: () => listeners.click(),
    hideTab() { document.hidden = true; listeners.visibility(); },
    get loads() { return loads; }, get active() { return active; }, button, status };
}
let s = await scenario();
await s.flush(); assert.equal(s.loads, 0);
s.show(true); s.show(false); await s.flush(); assert.equal(s.loads, 0, 'Leaving viewport cancels idle');
s.show(true); await s.flush(); assert.equal(s.loads, 1); assert(s.active);
s.show(false); assert(!s.active); s.show(true); await s.flush(); assert.equal(s.loads, 1, 'No duplicate loads');
for (const preference of [{ reduce: true }, { saveData: true }]) {
  s = await scenario(preference); s.show(true); await s.flush(); assert.equal(s.loads, 0);
  s.click(); await s.flush(); assert.equal(s.loads, 1);
}
s = await scenario(); s.show(true); s.hideTab(); await s.flush(); assert.equal(s.loads, 0);
s = await scenario({ fail: true }); s.show(true); s.click(); await s.flush();
assert.equal(s.button.disabled, false); assert(s.status.textContent.includes('Bild bleibt sichtbar'));
console.log('PASS: offscreen, leave-before-idle, visible idle, deduplication, reduced motion, save-data, hidden tab, load failure.');
