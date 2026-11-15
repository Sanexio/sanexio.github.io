/** Exact source IDs only. This module never infers anatomy or fetches externally. */
export async function createStructureLexicon(host, manifest, manifestBytes) {
  const box = document.createElement('p');
  box.id = 'avatar-lexikon'; box.className = 'muted'; box.setAttribute('aria-live', 'polite');
  host.querySelector('#avatar-treffer').after(box);
  const hash = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
  let bindings = new Map(), failure = '';
  try {
    const response = await fetch(new URL('./lexikon-bindungen.json', import.meta.url));
    if (!response.ok) throw Error('Quellenpaket fehlt');
    const data = await response.json();
    if (data.schema !== 'dht-structure-lexicon/1' || data.sex !== 'male' || data.manifest_sha256 !== await hash(manifestBytes)) throw Error('Registerstand passt nicht');
    const assets = new Map(manifest.assets.map(a => [a.file, a.sha256]));
    const entries = new Map(manifest.entries.map(e => [e.id, e]));
    for (const binding of data.bindings) {
      const entry = entries.get(binding.id);
      if (!entry || bindings.has(binding.id) || !binding.geometry.length || entry.geometry.length !== binding.geometry.length || !binding.geometry.every((g,i) => entry.geometry[i] === g.file && assets.get(g.file) === g.sha256) || binding.text_sha256 !== await hash(new TextEncoder().encode(binding.text))) throw Error('Einzelbindung passt nicht');
      bindings.set(binding.id, binding);
    }
  } catch (error) { failure = error.message; bindings = new Map(); }
  function show(entry) {
    delete box.dataset.entry; delete box.dataset.source; delete box.dataset.sourceSha256;
    if (failure) {box.textContent = `Lexikonbindung nicht verfügbar: ${failure}.`; return;}
    const binding = bindings.get(entry?.id);
    if(!binding&&document.querySelector('.app')?.dataset.mode==='explore'){box.textContent='';return;}
    if (!binding) {box.textContent = entry ? 'Kein quellengebundener Lexikontext für diese Registerstruktur vorhanden.' : 'Lexikon: Registerstruktur wählen; Texte erscheinen nur bei belegter Einzelbindung.'; return;}
    box.dataset.entry = binding.id; box.dataset.source = binding.source; box.dataset.sourceSha256 = binding.source_sha256;
    if(document.querySelector('.app')?.dataset.mode==='explore'){box.textContent=binding.text;return;}
    box.textContent = `${binding.title}: ${binding.text} Quelle: eigenes DHT-Lexikon, Abschnitt „Was ist das?“, ${binding.id}. Keine neue ärztliche Prüfung; keine Diagnose oder individuelle Beratung.`;
  }
  show(null);
  return show;
}
