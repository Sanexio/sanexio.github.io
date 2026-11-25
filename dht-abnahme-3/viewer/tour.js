/** A short, optional orientation. No health information is stored. */
const STORAGE_KEY = 'dht-tour-erledigt-v1';
const steps = [
  ['Figur bewegen', 'Ziehen Sie die Figur zum Drehen. Mit „Verschieben“ greifen und verschieben Sie die Ansicht.'],
  ['Körperschichten', 'Wählen Sie eine Körperschicht aus, um andere Strukturen zu sehen.'],
  ['Organe entdecken', 'Wählen Sie die Organschicht und tippen Sie auf ein Organ oder suchen Sie nach seinem Namen.'],
  ['Wo tut es weh?', 'Über „Wo tut es weh?“ können Sie eine Körperregion auswählen. Ihre Angaben bleiben auf diesem Gerät.']
];

function wasSeen() {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}
function remember() {
  try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* Browsing remains usable when storage is unavailable. */ }
}

export function mountTour(root = document) {
  const navigation = root.querySelector('.dht-navigation');
  if (!navigation || navigation.querySelector('[data-dht-tour]')) return;
  const container = document.createElement('section');
  container.dataset.dhtTour = '';
  container.setAttribute('aria-label', 'Einführung');
  const restart = document.createElement('button');
  restart.type = 'button';
  restart.className = 'secondary';
  restart.textContent = 'Einführung starten';
  const card = document.createElement('div');
  card.hidden = true;
  const progress = document.createElement('p');
  const title = document.createElement('strong');
  const description = document.createElement('p');
  description.setAttribute('aria-live', 'polite');
  const actions = document.createElement('div');
  const back = document.createElement('button');
  const next = document.createElement('button');
  const skip = document.createElement('button');
  for (const button of [back, next, skip]) { button.type = 'button'; button.className = 'secondary'; }
  back.textContent = 'Zurück';
  skip.textContent = 'Überspringen';
  actions.append(back, next, skip);
  card.append(progress, title, description, actions);
  container.append(restart, card);
  navigation.append(container);
  let index = 0;
  function render() {
    progress.textContent = `Einführung ${index + 1} von ${steps.length}`;
    title.textContent = steps[index][0];
    description.textContent = steps[index][1];
    back.hidden = index === 0;
    next.textContent = index === steps.length - 1 ? 'Fertig' : 'Weiter';
  }
  function start() { index = 0; card.hidden = false; restart.hidden = true; render(); }
  function finish() { remember(); card.hidden = true; restart.hidden = false; restart.focus(); }
  restart.addEventListener('click', start);
  back.addEventListener('click', () => { if (index > 0) { index--; render(); } });
  next.addEventListener('click', () => { if (index === steps.length - 1) finish(); else { index++; render(); } });
  skip.addEventListener('click', finish);
  // The introduction is optional and starts only on request, so it cannot cover existing controls.
  return { start };
}

mountTour();
