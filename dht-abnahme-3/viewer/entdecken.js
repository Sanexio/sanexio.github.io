/** Local, non-clinical discovery progress. Only rendered layers are counted. */
const key = 'dht-entdeckte-koerperschichten-v1';
const valid = new Set(['haut', 'muskel', 'skelett', 'organ', 'binde', 'nerven', 'gefaesse']);
let discovered = new Set();
try {
  const saved = JSON.parse(localStorage.getItem(key) || '[]');
  if (Array.isArray(saved)) discovered = new Set(saved.filter(id => valid.has(id)));
} catch { /* Storage can be unavailable; discovery still works for this visit. */ }

const app = document.querySelector('.app');
const panel = document.createElement('section');
panel.className = 'entdecken-progress';
panel.setAttribute('aria-label', 'Entdeckte Körperschichten');
const label = document.createElement('strong');
const meter = document.createElement('progress');
meter.setAttribute('aria-label', 'Entdeckte Körperschichten');
const status = document.createElement('span');
status.className = 'entdecken-status';
status.setAttribute('role', 'status');
status.setAttribute('aria-live', 'polite');
panel.append(label, meter, status);
let feedbackTimer;

function render() {
  const layerPanel = app.querySelector('#avatar-stage .layer-panel');
  if (!layerPanel) return;
  if (panel.parentElement !== layerPanel) layerPanel.append(panel);
  const available = [...layerPanel.querySelectorAll('.layer-button[data-layer]')]
    .map(button => button.dataset.layer).filter(id => valid.has(id));
  if (!available.length) return;
  const count = available.filter(id => discovered.has(id)).length;
  const text = `${count} von ${available.length} Körperschichten entdeckt`;
  if (label.textContent !== text) label.textContent = text;
  meter.max = available.length;
  meter.value = count;
}

app.addEventListener('avatar-layer', event => {
  const id = event.detail?.layer;
  if (!valid.has(id)) return;
  const isNew = !discovered.has(id);
  discovered.add(id);
  if (isNew) {
    try { localStorage.setItem(key, JSON.stringify([...discovered])); } catch { /* Optional persistence. */ }
    const button = app.querySelector(`.layer-button[data-layer="${id}"]`);
    const name = button?.textContent.trim() || 'Körperschicht';
    status.textContent = `${name} entdeckt`;
    panel.classList.remove('entdecken-new');
    // Restart a short visual cue without changing the body's position.
    void panel.offsetWidth;
    panel.classList.add('entdecken-new');
    clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => panel.classList.remove('entdecken-new'), 600);
  }
  render();
});
const observer = new MutationObserver(render);
observer.observe(app, { childList: true, subtree: true });
render();
window.addEventListener('pagehide', event => {
  if (!event.persisted) { observer.disconnect(); clearTimeout(feedbackTimer); }
});
