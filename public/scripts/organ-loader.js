// This small bootstrap is the only eager script; all rendering dependencies are lazy.
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
for (const element of document.querySelectorAll('[data-organ-viewer]')) {
  const button = element.querySelector('[data-load]');
  const status = element.querySelector('.organ-status');
  let visible = false;
  let loading = false;
  let viewer;
  let idle;
  let timer;
  let requested = false;
  button.hidden = false;
  status.textContent = 'Ziehen zum Drehen, Mausrad oder zwei Finger zum Zoomen.';
  const cancel = () => {
    clearTimeout(timer);
    if (idle !== undefined && 'cancelIdleCallback' in window) cancelIdleCallback(idle);
    idle = undefined;
  };
  async function load() {
    if (!visible || loading || viewer) return;
    loading = true;
    cancel();
    button.disabled = true;
    status.textContent = '3D-Ansicht wird geladen …';
    try {
      const { createViewer } = await import('./organ-viewer.js');
      viewer = await createViewer(element, reducedMotion);
      viewer.setVisible(visible && !document.hidden);
      button.hidden = true;
      status.textContent = 'Ziehen zum Drehen; Pfeiltasten drehen, +/− zoomen, Pos1 setzt zurück.';
    } catch {
      status.textContent = '3D ist gerade nicht verfügbar. Das Bild bleibt sichtbar; Du kannst es erneut versuchen.';
      button.textContent = '3D erneut laden';
      button.disabled = false;
    } finally {
      loading = false;
    }
  }
  function schedule() {
    cancel();
    if (!visible || document.hidden || viewer || loading) return;
    if (requested) { void load(); return; }
    // Reduced motion and data saving require an explicit click, never automatic loading.
    if (reducedMotion.matches || navigator.connection?.saveData) return;
    timer = setTimeout(() => {
      if ('requestIdleCallback' in window) idle = requestIdleCallback(() => void load());
      else void load();
    }, 1500);
  }
  button.addEventListener('click', () => { requested = true; void load(); });
  reducedMotion.addEventListener('change', schedule);
  document.addEventListener('visibilitychange', () => {
    viewer?.setVisible(visible && !document.hidden);
    schedule();
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      viewer?.setVisible(visible && !document.hidden);
      schedule();
    }, { threshold: 0.15 }).observe(element);
  } else {
    // Without visibility observation, only an explicit visible button click loads 3D.
    button.addEventListener('click', () => { visible = true; void load(); });
  }
}
