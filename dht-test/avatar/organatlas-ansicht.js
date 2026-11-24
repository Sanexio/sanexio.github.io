import {Color} from 'three';
import {GLTFLoader} from './vendor/loaders/GLTFLoader.js';
import {MeshoptDecoder} from './vendor/meshopt/meshopt_decoder.js';
import {DRACOLoader} from './vendor/loaders/DRACOLoader.js';
import {referenceView} from './reference-view.js';
import {sha256} from './local-source.js';
const base = new URL('./organatlas/', import.meta.url);
const suffix = {female:'weiblicher Atlas',male:'männlicher Atlas','spl-manix':'SPL-Atlas',atlas:'Z-Anatomy',bodyparts:'BodyParts3D',frauatlas:'HuBMAP'};

export async function openOrganAtlas(host, organ, sex, signal) {
  const dialog = document.createElement('dialog');
  dialog.className = 'organ-atlas';
  dialog.setAttribute('aria-labelledby','atlas-title');
  dialog.innerHTML = `<div class="atlas-heading"><h2 id="atlas-title">Anatomieatlas</h2><button type="button" class="secondary" autofocus>Schließen</button></div>
    <label>Modell <select disabled></select></label><div class="atlas-stage"></div>
    <label class="atlas-vessels" hidden><input type="checkbox"> Anschlussgefäße zeigen</label><p role="status" aria-live="polite"></p><details><summary>Quelle und Lizenz</summary><p></p>
    <a href="${new URL('LIZENZEN.txt',base).href}" target="_blank" rel="noopener">Lokale Lizenztexte</a></details>`;
  host.append(dialog);
  const select = dialog.querySelector('select'), stage = dialog.querySelector('.atlas-stage');
  const status = dialog.querySelector('[role=status]'), credit = dialog.querySelector('details p');
  const lifetime = new AbortController();
  const vessels = dialog.querySelector('.atlas-vessels');
  const checkbox = vessels.querySelector('input');
  let request, view, generation = 0, connections = [];
  checkbox.addEventListener('change', () => {
    for (const mesh of connections) mesh.visible = checkbox.checked;
    view?.reset();
  });
  const draco = new DRACOLoader().setDecoderPath(new URL('./vendor/draco/',import.meta.url).href).setWorkerLimit(1);
  const loader = new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);
  const close = () => { if (dialog.open) dialog.close(); };
  signal?.addEventListener('abort', close, {once:true});
  dialog.addEventListener('close', () => {
    ++generation; lifetime.abort(); request?.abort(); draco.dispose(); view?.dispose(); dialog.remove();
    signal?.removeEventListener('abort', close);
  }, {once:true});
  dialog.querySelector('.atlas-heading button').addEventListener('click', close);
  dialog.showModal();status.textContent = 'Modelle werden geladen …';
  let catalog;
  try {
    const response = await fetch(new URL('katalog.json',base),{signal:lifetime.signal});
    if (!response.ok) throw Error();
    catalog = await response.json();
  } catch {
    if (!lifetime.signal.aborted) status.textContent = 'Der lokale Modellkatalog konnte nicht geladen werden.';
    return;
  }
  if (!dialog.open) return;
  catalog.sort((a,b) => a.name.localeCompare(b.name,'de') || a.sex.localeCompare(b.sex));
  for (const category of new Set(catalog.map(row => row.category || 'Organmodelle'))) {
    const group = document.createElement('optgroup');
    group.label = category;
    for (const row of catalog.filter(r => (r.category || 'Organmodelle') === category)) {
      group.append(new Option([row.name,suffix[row.sex]].filter(Boolean).join(' · '),row.id));
    }
    select.append(group);
  }
  select.value = (catalog.find(r => r.organ === organ && r.sex === sex) ||
    catalog.find(r => r.organ === organ) || catalog.find(r => r.organ === 'herz' && r.sex === sex)).id;
  select.disabled = false;
  async function draw() {
    const current = ++generation;
    request?.abort(); request = new AbortController();
    const row = catalog.find(r => r.id === select.value);
    const spec = row.variants[matchMedia('(max-width:760px)').matches ? 'mobil' : 'desktop'];
    stage.hidden = true; delete stage.dataset.model; vessels.hidden = true; checkbox.checked = false; connections = [];
    credit.textContent = [row.credit, row.optimized ? 'Für den Browser zusätzlich vereinfacht.' : '',row.license,row.licenseUrl].filter(Boolean).join(' ');
    status.textContent = row.name + ' wird geladen …';
    try {
      const response = await fetch(new URL(spec.file,base),{signal:request.signal});
      if (!response.ok) throw Error();
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength !== spec.bytes || await sha256(bytes) !== spec.sha256) throw Error();
      if (current !== generation || !dialog.open) return;
      let scene, parser;
      if (spec.file.endsWith('.obj')) {
        const {OBJLoader} = await import('./vendor/loaders/OBJLoader.js');
        scene = new OBJLoader().parse(new TextDecoder().decode(bytes));
        scene.rotation.x = -Math.PI / 2;
        scene.scale.setScalar(.001);
      } else {
        ({scene,parser} = await loader.parseAsync(bytes,base.href));
      }
      if (current !== generation || !dialog.open) { releaseScene(scene); return; }
      scene.traverse(node => {
        if (!node.isMesh) return;
        const part = node.userData.x5;
        const name = parser?.json.nodes[parser.associations.get(node)?.nodes]?.name || '';
        if (name.startsWith('1:')) {node.visible = false; connections.push(node);}
        else if (part?.default_visible === false) node.visible = false;
        const tissue = part?.gewebeklasse || '';
        const tone = tissue === 'arterie' ? 0xb6514b : tissue === 'vene' ? 0x4e8297
          : (/knorpel|klappe|kapsel|knochen/.test(tissue) || row.category === 'Skelett im weiblichen Quellatlas') ? 0xd6bb94
          : row.organ === 'leber' || row.organ === 'milz' ? 0x996062
          : row.organ === 'gehirn' ? 0xcb9c93 : 0xc97b70;
        for (const material of [].concat(node.material)) {
          material.color?.lerp(new Color(tone), .86);
          material.emissiveIntensity = .025;
          material.roughness = .65;
          material.metalness = 0;
          if (part?.default_visible !== false) {material.opacity = 1;material.transparent = false;material.depthWrite = true;}
        }
      });
      vessels.hidden = !connections.length;
      stage.hidden = false;
      view ||= referenceView(stage,'atlas-detail-canvas',{background:0x193347});
      view.set(scene,row.camera); stage.dataset.model = row.id;
      view.canvas.setAttribute('aria-label',row.name+' · drehbares Atlasmodell');
      status.textContent = (row.sex === 'frauatlas' ? 'Quellmodell ohne Körperhülle. ' : row.category === 'Muskelmodelle' ? 'Separates Quellmodell. ' : '') + 'Zum Drehen ziehen. Zum Vergrößern zoomen.';
    } catch {
      if (current === generation && dialog.open) status.textContent = 'Modell konnte nicht geladen werden. Wählen Sie ein anderes Modell oder öffnen Sie den Atlas erneut.';
    }
  }
  select.addEventListener('change',draw);
  await draw();
}
function releaseScene(scene) {
  scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of [].concat(o.material))m.dispose();}});
}
