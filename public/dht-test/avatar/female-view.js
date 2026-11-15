import * as THREE from 'three';
import {GLTFLoader} from './vendor/loaders/GLTFLoader.js';
import {OrbitControls} from './vendor/controls/OrbitControls.js';
import {femaleLabel, femaleBindingAllowed} from './female-policy.js';

const BASE = new URL('./', import.meta.url);
const LIMIT = 400000;
const systemLayer = system => system === 'VH_F_skeletal_system' ? 'skelett' : system === 'VH_F_muscular_system' ? 'muskel' : 'organ';
const button = (id, text, fn) => {
  const b = document.createElement('button'); b.id = id; b.type = 'button'; b.className = 'secondary'; b.textContent = text; b.addEventListener('click', fn); return b;
};

export async function createFemaleView(host, register, {signal} = {}) {
  host.innerHTML = '<p id="avatar-status" role="status">Weiblicher Quellatlas wird lokal geprüft …</p><div class="avatar-viewport"><div class="avatar-labels"></div></div><div class="avatar-actions"></div><div class="avatar-search"><label>Struktur suchen<input id="anatomie-suche" type="search" placeholder="Name oder Kennung eingeben" autocomplete="off"></label><label>Registerstruktur<select id="anatomie-struktur"></select></label></div><p id="avatar-treffer" aria-live="polite">Noch keine 3D-Struktur gewählt.</p><p id="avatar-binding-reason" class="notice"></p><p class="muted">Weiblicher Originalquellraum, kein Übertragen männlicher Anatomie. Haut und innere Netze stammen aus einer Teilansicht verschiedener Quellen; keine gesicherte räumliche Registrierung.</p><details><summary>Quellen und Lizenz</summary><p id="female-credits"></p></details>';
  const status = host.querySelector('#avatar-status'), detail = host.querySelector('#avatar-treffer'), reason = host.querySelector('#avatar-binding-reason');
  const select = host.querySelector('#anatomie-struktur'), search = host.querySelector('#anatomie-suche');
  const viewport = host.querySelector('.avatar-viewport'), labels = host.querySelector('.avatar-labels'), actions = host.querySelector('.avatar-actions');
  host.setAttribute('aria-busy', 'true');
  const progress = document.createElement('progress'); progress.id = 'female-load-progress';
  progress.setAttribute('aria-label', 'Weibliche Teilansicht laden'); status.after(progress);
  const paint = () => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
  status.textContent = 'Weibliche Teilansicht wird geladen …'; await paint();
  const web = await (await fetch(new URL('female-web.json', BASE), {signal})).json();
  if (web.original_sha256 !== register.geometry.sha256) throw new Error('Webfassung passt nicht zum Originalregister');
  const response = await fetch(new URL(web.file, BASE), {signal});
  if (!response.ok) throw new Error('Weibliche Webgeometrie lokal nicht vorhanden');
  const reader = response.body.getReader(), chunks = []; let received = 0;
  progress.max = web.bytes; progress.value = 0;
  while (true) {
    const {done, value} = await reader.read(); if (done) break;
    chunks.push(value); received += value.byteLength; progress.value = received;
    status.textContent = `Weibliche Teilansicht wird geladen … ${Math.min(100, Math.floor(received / web.bytes * 100))} %`;
  }
  if (received !== web.bytes) throw new Error('Webgeometrie unvollständig');
  const bytes = new Uint8Array(received); let offset = 0;
  for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.length;}
  status.textContent = 'Weibliche Geometrie wird geprüft …'; progress.removeAttribute('value'); await paint();
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
  if (hash !== web.sha256) throw new Error('Weibliche Webgeometrie-Prüfsumme abweichend');
  status.textContent = 'Weibliche Ansicht wird vorbereitet …'; await paint();
  const {DRACOLoader} = await import('./vendor/loaders/DRACOLoader.js');
  const decoder = new DRACOLoader().setDecoderPath(new URL('vendor/draco/', BASE).href).setDecoderConfig({type: 'wasm'}).setWorkerLimit(2);
  let gltf, deadline;
  try {
    gltf = await Promise.race([
      new Promise((resolve, reject) => new GLTFLoader().setDRACOLoader(decoder).parse(bytes.buffer, BASE.href, resolve, reject)),
      new Promise((_, reject) => {deadline = setTimeout(() => reject(new Error('Weibliche Ansicht konnte in diesem Browser nicht vorbereitet werden.')), 60000);})
    ]);
  } finally {clearTimeout(deadline); decoder.dispose();}
  const renderer = new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor(0xeaf0f3); renderer.domElement.id = 'avatar-canvas';
  renderer.domElement.setAttribute('aria-label', 'Weiblicher 3D-Avatar mit Standhinweis; ziehen zum Drehen, Rad zum Zoomen'); viewport.prepend(renderer.domElement);
  const scene = new THREE.Scene(); scene.add(gltf.scene);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x465469, 2.2));
  const light = new THREE.DirectionalLight(0xffffff, 2.8); light.position.set(1, 2, 3); scene.add(light);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.001, 100000);
  const controls = new OrbitControls(camera, renderer.domElement);
  search.value = '';
  const entries = new Map(register.entries.map(e => [e.source_node_index, e])), objects = new Map();
  let skin = null, skinTriangles = 0;
  // GLTFLoader's source-node associations are authoritative; never name-match.
  gltf.scene.traverse(o => {
    if (o.isMesh) o.visible = false;
    const index = gltf.parser.associations.get(o)?.nodes;
    if (index === undefined) return;
    const e = entries.get(index);
    if (!e && index !== 2) return;
    let triangles = 0;
    o.traverse(m => { if (m.isMesh) {
      triangles += (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3;
      m.material = new THREE.MeshStandardMaterial({color: index === 2 ? 0xb99d89 : systemLayer(e.system) === 'skelett' ? 0xe8ddbb : systemLayer(e.system) === 'muskel' ? 0xa94e48 : 0x658ca5, roughness: .8, side: index === 2 ? THREE.FrontSide : THREE.DoubleSide, forceSinglePass: true, transparent: false, opacity: 1});
      m.userData.entry = e;
    }});
    if (index === 2) {skin = o; skinTriangles = triangles;}
    else objects.set(e.id, {entry: e, object: o, triangles});
  });
  if (!skin || objects.size !== register.entries.length) throw new Error('Weibliches Register passt nicht vollständig zur Originalgeometrie');
  // World bounds and camera only: no deformation, fitted coordinates or relations.
  const bounds = new THREE.Box3().setFromObject(skin), center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
  let layer = 'haut', selected = null, labelsOn = false, lastHit = null;
  function frame(box, factor = 1.2) {
    const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    const distance = Math.max(s.y, s.x / camera.aspect, s.z, size.y / 100) / (2 * Math.tan(THREE.MathUtils.degToRad(17))) * factor;
    const dir = camera.position.clone().sub(controls.target).normalize(); if (!dir.lengthSq()) dir.set(0, 0, 1);
    controls.target.copy(c); camera.position.copy(c).addScaledVector(dir, distance); controls.update(); render();
  }
  function render() {
    renderer.render(scene, camera); labels.replaceChildren();
    if (!labelsOn) return;
    const candidates = [...objects.values()].filter(a => a.object.visible);
    if (selected) candidates.sort((a, b) => Number(b.entry.id === selected.id) - Number(a.entry.id === selected.id));
    for (const a of candidates.slice(0, 6)) {
      const p = new THREE.Box3().setFromObject(a.object).getCenter(new THREE.Vector3()).project(camera);
      if (Math.abs(p.x) > 1 || Math.abs(p.y) > 1 || Math.abs(p.z) > 1) continue;
      const el = document.createElement('span'); el.className = 'avatar-label'; el.textContent = femaleLabel(a.entry); el.dataset.entry = a.entry.id; el.style.whiteSpace = 'normal'; el.style.maxWidth = '220px';
      el.style.left = `${Math.max(0, Math.min(viewport.clientWidth - 180, (p.x + 1) * viewport.clientWidth / 2))}px`; el.style.top = `${(1 - p.y) * viewport.clientHeight / 2}px`; labels.append(el);
    }
  }
  function visibility() {
    // Preserve source scene hierarchy. Only mesh visibility is changed.
    gltf.scene.traverse(o => { if (o.isMesh) o.visible = false; });
    let triangles = 0, omitted = 0;
    const show = o => o.traverse(m => {if (m.isMesh) m.visible = true;});
    if (layer === 'haut' && skinTriangles <= LIMIT) {show(skin); triangles += skinTriangles;}
    const ordered = [...objects.values()].sort((a, b) => Number(b.entry.id === selected?.id) - Number(a.entry.id === selected?.id));
    for (const a of ordered) {
      const wanted = a.entry.id === selected?.id || (layer !== 'haut' && systemLayer(a.entry.system) === layer);
      if (!wanted) continue;
      if (triangles + a.triangles <= LIMIT) {show(a.object); triangles += a.triangles;} else omitted++;
    }
    status.textContent = `Weiblicher 3D-Quellatlas lokal bereit · ${register.entries.length} Registerstrukturen · ${triangles.toLocaleString('de-DE')} Dreiecke · ${omitted} Objekte durch Detailbudget ausgeblendet${layer === 'binde' ? ' · keine gesondert belegte Bänder-/Sehnenschicht' : ''}`;
    host.dataset.layer = layer; render();
  }
  function binding(e) {
    const allowed = femaleBindingAllowed(e);
    for (const id of ['avatar-focus', 'avatar-region']) host.querySelector('#' + id).disabled = !allowed;
    reason.textContent = allowed ? 'Gesicherte terminologische Einzelbindung. Kamera zeigt die vorhandene Quellgeometrie; keine klinische Lageabnahme.' : 'Strukturbindung gesperrt: ' + (!e ? 'keine gesicherte Struktur gewählt.' : e.quality === 'gesichert' ? 'nur ein Oberbegriff ist belegt, keine Einzelidentität.' : `${e.quality === 'wahrscheinlich' ? 'Benennung nur wahrscheinlich' : 'Struktur noch nicht benannt'}; keine gesicherte Zuordnung.`);
  }
  function choose(e, hit = null) {
    selected = e; lastHit = hit; select.value = e.id;
    layer = systemLayer(e.system); document.querySelector('#schicht-wahl').value = layer;
    for (const a of objects.values()) a.object.traverse(m => {if (m.isMesh) m.material.emissive.setHex(a.entry.id === e.id ? 0x164c43 : 0);});
    detail.textContent = `${femaleLabel(e)} · ${e.mesh} · ${e.quality === 'verworfen' ? 'Zuordnung verworfen. ' : ''}${e.reason || ''}`;
    host.dataset.selected = e.id; binding(e); visibility();
  }
  const rotate = angle => {camera.position.sub(controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).add(controls.target); controls.update(); render();};
  const zoom = f => {camera.position.sub(controls.target).multiplyScalar(f).add(controls.target); controls.update(); render();};
  actions.append(button('avatar-body', 'Körper', () => frame(bounds)), button('avatar-region', 'Region', () => {if (femaleBindingAllowed(selected)) frame(new THREE.Box3().setFromObject(objects.get(selected.id).object), 2);}), button('avatar-focus', 'Struktur', () => {if (femaleBindingAllowed(selected)) frame(new THREE.Box3().setFromObject(objects.get(selected.id).object));}), button('avatar-left', '↶ Drehen', () => rotate(Math.PI / 6)), button('avatar-right', 'Drehen ↷', () => rotate(-Math.PI / 6)), button('avatar-near', '＋ Näher', () => zoom(.75)), button('avatar-far', '− Weiter', () => zoom(1.33)));
  for (const name of ['Gewebe', 'Zelle', 'Molekül']) {const b = button('avatar-' + name.toLowerCase(), name + ' · keine Daten', () => {}); b.disabled = true; actions.append(b);}
  const fill = () => {
    select.replaceChildren(new Option('Struktur wählen', ''));
    for (const e of register.entries) if (`${femaleLabel(e)} ${e.mesh}`.toLocaleLowerCase('de').includes(search.value.toLocaleLowerCase('de'))) select.append(new Option(`${femaleLabel(e)} · ${e.mesh}`, e.id));
    if (selected) select.value = selected.id;
  };
  search.addEventListener('input', fill); select.addEventListener('change', () => {const a = objects.get(select.value); if (a) choose(a.entry);}); fill(); binding(null);
  const ray = new THREE.Raycaster(); let pointer = null;
  renderer.domElement.addEventListener('pointerdown', e => {pointer = [e.clientX, e.clientY];});
  renderer.domElement.addEventListener('pointerup', e => {
    if (!pointer || Math.hypot(e.clientX - pointer[0], e.clientY - pointer[1]) > 5) {pointer = null; return;} pointer = null;
    const r = renderer.domElement.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, 1 - (e.clientY - r.top) / r.height * 2), camera);
    const meshes = []; gltf.scene.traverse(m => {if (m.isMesh && m.visible && m.userData.entry) meshes.push(m);});
    const hit = ray.intersectObjects(meshes, false)[0]; if (hit) choose(hit.object.userData.entry, {faceIndex: hit.faceIndex, point: hit.point.toArray()});
  });
  host.querySelector('#female-credits').textContent = [...new Set(register.entries.flatMap(e => [...e.attribution, e.license]))].join(' · ') + ' · Abgeleitete Namenszuordnungen: CC BY-SA 4.0. Webgeometrie fein quantisiert und komprimiert, ohne Vereinfachung; Original unverändert. Ohne Außenlieger und Plazenta in der Auswahl; keine vereinheitlichte Spenderquelle.';
  controls.addEventListener('change', render);
  const resize = new ResizeObserver(() => {const w = viewport.clientWidth, h = viewport.clientHeight; if (!w || !h) return; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); render();}); resize.observe(viewport);
  camera.position.copy(center).add(new THREE.Vector3(0, 0, size.y * 2)); controls.target.copy(center); frame(bounds); visibility(); progress.hidden = true; host.setAttribute('aria-busy', 'false'); host.dataset.ready = 'true';
  const api = {
    setLayer(value) {layer = value; search.value = ''; fill(); selected = null; lastHit = null; select.value = ''; delete host.dataset.selected; detail.textContent = 'Schicht gewechselt — Struktur wählen.'; binding(null); visibility();},
    setOpacity(value) {skin.traverse(m => {if (m.isMesh) {m.material.opacity = value; m.material.transparent = value < 1; m.material.depthWrite = value >= 1; m.material.needsUpdate = true;}}); render();},
    setLabels(value) {labelsOn = value; render();}, focusRegion() {},
    state() {return {sex: 'female', selected: selected?.id, quality: selected?.quality, bindingAllowed: femaleBindingAllowed(selected), hit: lastHit, layer, register: register.entries.length, skinOpacity: skin.material.opacity, skinSide: skin.material.side, triangles: renderer.info.render.triangles, camera: camera.position.toArray(), target: controls.target.toArray()};},
    dispose() {resize.disconnect(); controls.dispose(); scene.traverse(m => {if (m.isMesh) {m.geometry.dispose(); m.material.dispose();}}); renderer.dispose();}
  };
  Object.defineProperty(host, 'avatarInventory', {value: () => [...objects.values()].map(a => ({id: a.entry.id, node: a.entry.source_node_index, name: a.object.name, triangles: a.triangles}))});
  Object.defineProperty(host, 'avatarState', {value: () => api.state()});
  return api;
}
