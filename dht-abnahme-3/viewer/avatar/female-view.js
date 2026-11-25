import {structurePickLabel} from './structure-pick-label.js';
import {dashboardMotion,dashboardContext,layerExampleMarker,surfaceExampleAnchor} from './dashboard-motion.js';
import {femaleSourceNodes} from './frauatlas-quellen.js';
import {attachOrganAtlas} from './organatlas-suche.js';
import {organSearchTerms} from './organnamen.js';
import {femaleDataMarkers} from './female-data-markers.js';
import {mountAvatarShell,femaleLayerChoices as layerChoices,femalePeelLayers as peelLayers} from './explore-shell.js';
import * as THREE from 'three';
import {GLTFLoader} from './vendor/loaders/GLTFLoader.js';
import {OrbitControls} from './vendor/controls/OrbitControls.js';
import {studio,outlineMaterial,calmGlassFace} from './look1-style.js';
import {smoothHullNormals} from './smooth-hull.js';
import {MeshoptDecoder} from './vendor/meshopt/meshopt_decoder.js';
import {layerLifecycle,organsAfterPaint,surfaceSelection,replayPendingSelection} from './layer-lifecycle.js';
import {femaleLabel, femaleBindingAllowed, femaleFitNote} from './female-policy.js';

const BASE = new URL('./', import.meta.url);
const LIMIT = 400000;
const systemLayer = system => system === 'VH_F_skeletal_system' ? 'skelett' : system === 'VH_F_muscular_system' ? 'muskel' : 'organ';
const button = (id, text, fn) => {
  const b = document.createElement('button'); b.id = id; b.type = 'button'; b.className = 'secondary'; b.textContent = text; b.addEventListener('click', fn); return b;
};

export async function createFemaleView(host, register, {signal,onDataOrgan=()=>{}} = {}) {
  mountAvatarShell(host,{female:true});
  [...host.querySelectorAll('#technical-info > p')].at(-1).textContent=femaleFitNote;
  const reasonNode=document.createElement('p');reasonNode.id='avatar-binding-reason';reasonNode.className='notice';host.querySelector('#technical-info').append(reasonNode);
  const credits=document.createElement('p');credits.id='female-credits';host.querySelector('#technical-info').append(credits);
  host.querySelector('#muscle-coverage').textContent='Illustrativ eingepasste weibliche Atlasstrukturen; keine individuelle Morphometrie.';
  host.querySelector('.quick-suggestions').replaceChildren();
  const status = host.querySelector('#avatar-status'), detail = host.querySelector('#avatar-treffer'), reason = host.querySelector('#avatar-binding-reason');
  const select = host.querySelector('#anatomie-struktur'), search = host.querySelector('#anatomie-suche');
  const viewport = host.querySelector('.avatar-viewport'), labels = host.querySelector('.avatar-labels'), actions = host.querySelector('.avatar-actions');
  host.setAttribute('aria-busy', 'true');
  const progress = host.querySelector('#male-load-progress'); progress.id = 'female-load-progress';
  progress.setAttribute('aria-label', 'Weibliche Teilansicht laden');
  const paint = () => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
  status.textContent = 'Weibliche Teilansicht wird geladen …'; await paint();
  const web = await (await fetch(new URL('female-web.json', BASE), {signal})).json();
  if(web.original_sha256!==register.geometry.sha256)throw Error('Webfassung passt nicht zum Originalregister');
  const digest=async data=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(b=>b.toString(16).padStart(2,'0')).join('');
  async function download(spec,quiet=false){
    const response=await fetch(new URL(spec.file,BASE),{signal});if(!response.ok)throw Error('3D-Datei fehlt: '+spec.file);
    if(!quiet){progress.hidden=false;progress.max=spec.bytes;progress.value=0;}
    const reader=response.body.getReader(),chunks=[];let received=0;
    while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);received+=value.length;
      if(!quiet){progress.value=received;status.textContent=`Weibliche Ansicht wird geladen … ${Math.min(100,Math.floor(received/spec.bytes*100))} %`;}}
    const data=new Uint8Array(received);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
    if(received!==spec.bytes||await digest(data)!==spec.sha256)throw Error('Weibliche Webgeometrie-Prüfsumme abweichend');return data.buffer;
  }
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  async function parse(bytes){let timer;try{return await Promise.race([new Promise((resolve,reject)=>loader.parse(bytes,BASE.href,resolve,reject)),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Weibliche Ansicht konnte in diesem Browser nicht vorbereitet werden.')),60000);})]);}finally{clearTimeout(timer);}}
  const gltf=await parse(await download(web));
  const renderer = new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
  const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info'),device=debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):'';
  const economy=/swiftshader|llvmpipe|softpipe|software/i.test(device);
  host.dataset.renderer=device;host.dataset.renderQuality=economy?'economy':'full';
  const SurfaceMaterial=economy?THREE.MeshLambertMaterial:THREE.MeshStandardMaterial;
  renderer.setPixelRatio(economy?.75:Math.min(devicePixelRatio,2));renderer.domElement.id='avatar-canvas';
  renderer.domElement.setAttribute('aria-label','Weiblicher Glas-Avatar; ziehen zum Drehen, Rad zum Zoomen');viewport.prepend(renderer.domElement);
  const scene=new THREE.Scene();scene.add(gltf.scene);
  const disposeStudio=studio(renderer,scene,viewport,{economy});
  viewport.style.background='radial-gradient(ellipse at 45% 26%, #426b80 0%, #294d66 57%, #183649 100%)';
  const camera = new THREE.PerspectiveCamera(34, 1, 0.001, 100000);
  const controls = new OrbitControls(camera, renderer.domElement);
  const layerById=new Map(Object.entries(web.layers).flatMap(([layer,packs])=>packs.flatMap(p=>p.ids.map(id=>[id,layer]))));
  const objects=new Map(register.entries.map(entry=>[entry.id,{entry,object:null,triangles:0,layer:layerById.get(entry.id)}]));
  const markers=femaleDataMarkers({THREE,viewport,objects,camera,onDataOrgan});
  let markerSignature=null;
  const skin=gltf.scene;skin.updateWorldMatrix(true,true);let skinTriangles=0,skinOpacity=1;
  skin.traverse(m=>{if(m.isMesh){skinTriangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;smoothHullNormals(m.geometry);m.material=outlineMaterial(economy,true);m.userData.skinMaterial=m.material;m.userData.outlineMaterial=outlineMaterial(economy);m.userData.faceMaterial=calmGlassFace(m,economy,1.48);}});
  const layerStatus=host.querySelector('#layer-status');
  const {ensureLayer,loaded}=layerLifecycle({host,progress,layerStatus,
    async load(value,{background,added}){
      // These HRA structures are already fitted and bound in this atlas's organ packs.
      if(value==='nerven'){await ensureLayer('organ',{background});return;}
      for(const spec of web.layers[value]||[]){
        const group=(await parse(await download(spec,background))).scene;
        const ids=[];
        group.traverse(o=>{if(!o.isMesh)return;const id=o.userData.id,a=objects.get(id);if(!a||!spec.ids.includes(id)||o.userData.nicht_eingepasst!==false||o.userData.show_with_shell!==true)throw Error('Einpassungsbindung abweichend');
          let triangles=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;
          smoothHullNormals(o.geometry);o.material=new SurfaceMaterial({color:value==='skelett'?0xe8ddbb:value==='binde'?0xd5b273:0xb75743,...(economy?{}:{roughness:.45}),side:THREE.DoubleSide,forceSinglePass:true});
          o.userData.baseColor=o.material.color.clone();o.userData.entry=a.entry;
          a.object=o;a.triangles=triangles;o.visible=false;ids.push(id);added.push(id);
        });
        if(ids.length!==spec.ids.length)throw Error('Einpassungsumfang abweichend');scene.add(group);
      }
    },
    rollback(added){for(const id of added){const a=objects.get(id);a.object?.removeFromParent();a.object?.geometry.dispose();a.object?.material.dispose();a.object=null;}}
  });
  // World bounds and camera only: no deformation, fitted coordinates or relations.
  const bounds = new THREE.Box3().setFromObject(skin), center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
  let layer = 'haut', selected = null, labelsOn = false, lastHit = null, generation=0,initialLayerApplied=false;
  let dataActive=false;
  const pickLabel=structurePickLabel({viewport,camera,THREE});
  const skinExample=surfaceExampleAnchor(THREE,skin,'haut','Hautoberfläche');
  const exampleMarker=layerExampleMarker({THREE,host,viewport,camera,enabled:()=>dataActive&&layer!=='organ',anchor:()=>{if(layer==='haut')return skinExample;for(const a of objects.values()){if((a.layer===layer||(layer==='nerven'&&a.entry.system==='VH_F_nervous_system'))&&a.object?.visible&&femaleBindingAllowed(a.entry))return {object:a.object,layer,id:a.entry.id,name:femaleLabel(a.entry)};}return null;}});
  function frame(box, factor = 1.12) {
    const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    const distance = Math.max(s.y, s.x / camera.aspect, s.z, size.y / 100) / (2 * Math.tan(THREE.MathUtils.degToRad(17))) * factor;
    const dir = camera.position.clone().sub(controls.target).normalize(); if (!dir.lengthSq()) dir.set(0, 0, 1);
    controls.target.copy(c); camera.position.copy(c).addScaledVector(dir, distance); controls.update(); render();
  }
  function render() {
    renderer.render(scene, camera); pickLabel.paint(); markers.paint();exampleMarker.paint();dashboardContext({host,camera,controls,bodyHeight:size.y,layer,selected:!!selected,name:selected?femaleLabel(selected):'Struktur'});labels.replaceChildren();
    if (!labelsOn) return;
    const candidates = [...objects.values()].filter(a => a.object?.visible);
    if (selected) candidates.sort((a, b) => Number(b.entry.id === selected.id) - Number(a.entry.id === selected.id));
    for (const a of candidates.slice(0, 6)) {
      const p = new THREE.Box3().setFromObject(a.object).getCenter(new THREE.Vector3()).project(camera);
      if (Math.abs(p.x) > 1 || Math.abs(p.y) > 1 || Math.abs(p.z) > 1) continue;
      const el = document.createElement('span'); el.className = 'avatar-label'; el.textContent = femaleLabel(a.entry); el.dataset.entry = a.entry.id; el.style.whiteSpace = 'normal'; el.style.maxWidth = '220px';
      el.style.left = `${Math.max(0, Math.min(viewport.clientWidth - 180, (p.x + 1) * viewport.clientWidth / 2))}px`; el.style.top = `${(1 - p.y) * viewport.clientHeight / 2}px`; labels.append(el);
    }
  }
  function visibility() {
    skin.traverse(m=>{if(m.isMesh)m.material=layer==='haut'?[m.userData.skinMaterial,m.userData.faceMaterial]:m.userData.outlineMaterial;});
    let triangles=skinTriangles,omitted=0;
    // Torso organs first in the glass overview; no skull/eye fragments in the face.
    const priority=a=>layer==='nerven'&&/spinal_cord|lateral_hemisphere_of_cerebellum|basilar_part_of_pons/i.test(a.entry.mesh)?-1:/bronchopulmonary|^VH_F_(left|right)_(cardiac_atrium|ventricle)$|^VH_F_interventricular_septum$/i.test(a.entry.mesh)?0:/mammary_lobes/i.test(a.entry.mesh)?1:/lung|stomach|intestin|colon|uter|heart|bladder/i.test(a.entry.mesh)?2:3;
    const ordered=[...objects.values()].filter(a=>a.object).sort((a,b)=>Number(markers.present.has(b.entry.id))-Number(markers.present.has(a.entry.id))||Number(b.entry.id===selected?.id)-Number(a.entry.id===selected?.id)||priority(a)-priority(b));
    for(const a of ordered){
      const box=new THREE.Box3().setFromObject(a.object),c=box.getCenter(new THREE.Vector3());
      const wanted=markers.present.has(a.entry.id)||a.entry.id===selected?.id||(layer==='haut'?a.layer==='organ'&&c.y<size.y*.85:(layer==='nerven'?a.entry.system==='VH_F_nervous_system':a.layer===layer));
      a.object.visible=Boolean(wanted&&triangles+a.triangles<=LIMIT);
      if(a.object.visible)triangles+=a.triangles;else if(wanted)omitted++;
      surfaceSelection(a.object.material,a.object.userData.baseColor,{selected:a.entry.id===selected?.id,muted:Boolean(selected&&!lastHit&&a.entry.id!==selected.id),opacity:layer==='haut'?.44:1});
    }
    status.textContent=`Weiblicher Glas-Avatar lokal bereit · 761 von 868 Strukturen eingepasst · ${triangles.toLocaleString('de-DE')} Dreiecke · ${omitted} Objekte durch Detailbudget ausgeblendet`;
    if(layer==='haut'&&host.dataset.organs==='error')layerStatus.textContent='Organe konnten nicht geladen werden. Die Glasfigur bleibt bedienbar.';
    else layerStatus.textContent=(layerChoices.find(c=>c[0]===layer)?.[2]||layer)+' · bereit';
    host.dataset.layer=layer;host.dataset.triangles=triangles;host.dispatchEvent(new CustomEvent('avatar-layer',{bubbles:true,detail:{layer}}));
    for(const b of host.querySelectorAll('[data-layer]'))b.setAttribute('aria-pressed',String(b.dataset.layer===layer));
    host.querySelector('#layer-peel').value=peelLayers.indexOf(layer);
    host.querySelector('#layer-peel').setAttribute('aria-valuetext',layerChoices.find(c=>c[0]===layer)?.[2]||'');render();
  }
  function binding(e) {
    const allowed = femaleBindingAllowed(e)&&Boolean(objects.get(e?.id)?.object);
    for (const id of ['avatar-focus', 'avatar-region']) host.querySelector('#' + id).disabled = !allowed;
    reason.textContent = e&&!objects.get(e.id)?.layer ? 'Strukturbindung gesperrt: in der weiblichen Ansicht noch nicht enthalten.' : allowed ? 'Gesicherte terminologische Einzelbindung. Kamera zeigt die vorhandene Quellgeometrie; keine klinische Lageabnahme.' : 'Strukturbindung gesperrt: ' + (!e ? 'keine gesicherte Struktur gewählt.' : e.quality === 'gesichert' ? 'nur ein Oberbegriff ist belegt, keine Einzelidentität.' : `${e.quality === 'wahrscheinlich' ? 'Benennung nur wahrscheinlich' : 'Struktur noch nicht benannt'}; keine gesicherte Zuordnung.`);
  }
  async function choose(e,hit=null){
    const task=++generation,a=objects.get(e.id);
    const commitSelection=()=>{
      selected=e;lastHit=hit;select.value=e.id;
      detail.textContent=`${femaleLabel(e)} · ${e.mesh} · ${e.quality==='verworfen'?'Zuordnung verworfen. ':''}${e.reason||''}`;
      host.dataset.selected=e.id;const badge=host.querySelector('#canvas-name');badge.querySelector('p').textContent=femaleLabel(e);badge.hidden=false;return badge;
    };
    if(!a.layer){
      const badge=commitSelection();
      detail.append(document.createTextNode(' — in der weiblichen Ansicht noch nicht enthalten. '));
      badge.querySelector('p').append(document.createTextNode(' · in der weiblichen Ansicht noch nicht enthalten'));
      if (femaleSourceNodes.has(e.source_node_index)) {
        const source = button('female-source-model', 'Quellmodell einzeln ansehen', async () => {
          source.disabled = true;
          try {
            const {openOrganAtlas} = await import('./organatlas-ansicht.js');
            if (!signal?.aborted && host.isConnected) await openOrganAtlas(host, 'frau2-' + e.source_node_index, 'frauatlas', signal);
          } catch {
            if (!signal?.aborted) source.textContent = 'Quellmodell erneut öffnen';
          } finally { source.disabled = false; }
        });
        detail.append(source);
      }
      detail.append(button('female-missing-male','Zur männlichen Ansicht',()=>document.querySelector('#avatar-maennlich')?.click()));binding(e);visibility();return;
    }
    try{await ensureLayer(a.layer);if(task!==generation||signal?.aborted)return;
      commitSelection();if(femaleBindingAllowed(e))host.dispatchEvent(new CustomEvent('anamnese-auswahl',{bubbles:true,detail:{id:e.id,name:femaleLabel(e)}}));layer=hit?layer:layer==='nerven'&&e.system==='VH_F_nervous_system'?'nerven':a.layer;document.querySelector('#schicht-wahl').value=layer;binding(e);visibility();
    }catch(error){if(task===generation){select.value=selected?.id||'';layerStatus.textContent=error.message;}}
  }
  const rotate = angle => {camera.position.sub(controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).add(controls.target); controls.update(); render();};
  const zoom = f => {camera.position.sub(controls.target).multiplyScalar(f).add(controls.target); controls.update(); render();};
  actions.append(button('avatar-body', 'Körper', () => {controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(0, 0, size.y * 2));frame(bounds);}), button('avatar-region', 'Region', () => {if (femaleBindingAllowed(selected)&&objects.get(selected.id)?.object) frame(new THREE.Box3().setFromObject(objects.get(selected.id).object), 2);}), button('avatar-focus', 'Struktur', () => {if (femaleBindingAllowed(selected)&&objects.get(selected.id)?.object) frame(new THREE.Box3().setFromObject(objects.get(selected.id).object));}), button('avatar-left', '↶ Drehen', () => rotate(Math.PI / 6)), button('avatar-right', 'Drehen ↷', () => rotate(-Math.PI / 6)), button('avatar-near', '＋ Näher', () => zoom(.75)), button('avatar-far', '− Weiter', () => zoom(1.33)));
  for (const name of ['Gewebe', 'Zelle', 'Molekül']) {const b = button('avatar-' + name.toLowerCase(), name + ' · keine Daten', () => {}); b.disabled = true; actions.append(b);}
  const results=host.querySelector('#search-results');
  const fill = () => {
    results.replaceChildren();results.hidden=!search.value;
    select.replaceChildren(new Option('Struktur wählen', ''));
    const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('de').trim();
    const term = normalize(search.value);
    const matches = register.entries.filter(e => normalize([femaleLabel(e), e.mesh, organSearchTerms(e)].join(' ')).includes(term));
    if (term) matches.sort((a,b) => Number(layerById.has(b.id)) - Number(layerById.has(a.id))
      || Number(normalize(organSearchTerms(b)) === term) - Number(normalize(organSearchTerms(a)) === term));
    for (const e of matches) select.append(new Option(`${femaleLabel(e)} · ${e.mesh}`, e.id));
    if (selected) select.value = selected.id;
    if(search.value)for(const option of [...select.options].slice(1,9)){const e=objects.get(option.value)?.entry;if(e)results.append(button('female-result-'+e.source_node_index,femaleLabel(e)+(layerById.has(e.id)?'':' · in der weiblichen Ansicht noch nicht enthalten'),()=>void choose(e)));}

  };
  const refreshAtlas = attachOrganAtlas(host, 'female', signal);
  search.addEventListener('input', fill); select.addEventListener('change', () => {const a = objects.get(select.value); if (a) void choose(a.entry);}); fill(); binding(null);
  const ray = new THREE.Raycaster(); let pointer = null, pointerMoved = false;
  renderer.domElement.addEventListener('pointerdown', e => {pointerMoved=Boolean(pointer);pointer = [e.clientX, e.clientY];});
  renderer.domElement.addEventListener('pointermove', e => {if(pointer&&Math.hypot(e.clientX-pointer[0],e.clientY-pointer[1])>=5)pointerMoved=true;});
  renderer.domElement.addEventListener('pointercancel', () => {pointer=null;pointerMoved=true;});
  renderer.domElement.addEventListener('pointerup', e => {
    if (!pointer || pointerMoved || Math.hypot(e.clientX - pointer[0], e.clientY - pointer[1]) >= 5) {pointer = null; return;} pointer = null;
    const r = renderer.domElement.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, 1 - (e.clientY - r.top) / r.height * 2), camera);
    const meshes = []; scene.traverse(m => {if (!m.isMesh || !m.userData.entry) return;for(let o=m;o;o=o.parent)if(!o.visible)return;meshes.push(m);});
    const hit = ray.intersectObjects(meshes, false)[0] || (layer==='haut'?ray.intersectObject(skin,true)[0]:null);
    const original=hit?.object.userData.entry;
    const groupLabels={haut:'Haut',organ:'Organe (Gruppe)',skelett:'Skelett (Gruppe)',muskel:'Muskulatur (Gruppe)',binde:'Bindegewebe (Gruppe)',nerven:'Nervensystem (Gruppe)'};
    const entry=original || (hit?{id:'haut',groupLabel:'Haut'}:null);
    if (!entry || selected?.id === entry.id) {++generation;selected=null;lastHit=null;select.value='';delete host.dataset.selected;pickLabel.clear();host.querySelector('#canvas-name').hidden=true;binding(null);visibility();return;}
    const name=femaleBindingAllowed(entry)?femaleLabel(entry):groupLabels[original ? (layer==='nerven'?'nerven':objects.get(entry.id)?.layer) : 'haut'];
    pickLabel.show(name,hit.point);host.dispatchEvent(new CustomEvent('dht:struktur-gewaehlt',{bubbles:true,detail:{id:entry.id,name,ebene:layer}}));
    if(femaleBindingAllowed(entry)){void choose(entry, {faceIndex: hit.faceIndex, point: hit.point.toArray()});return;}
    ++generation;selected={...entry,groupLabel:name};lastHit={faceIndex:hit.faceIndex,point:hit.point.toArray()};select.value='';host.dataset.selected=entry.id;detail.textContent=name;binding(null);visibility();
  });
  host.querySelector('#female-credits').textContent='Hülle: MakeHuman hm08 und Kern-Targets, CC0-1.0. Atlas: CC BY 4.0; Kristen Browne; Heidi Schlehlein; HuBMAP; Courtesy of the U.S. National Library of Medicine. Abgeleitete Namenszuordnungen: CC BY-SA 4.0. '+femaleFitNote;
  const disposeMotion=dashboardMotion({THREE,host,viewport,canvas:renderer.domElement,camera,controls,actions,render});
  controls.addEventListener('change', render);
  const resize = new ResizeObserver(() => {const w = viewport.clientWidth, h = viewport.clientHeight; if (!w || !h) return; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); render();}); resize.observe(viewport);
  renderer.setSize(viewport.clientWidth,viewport.clientHeight);camera.aspect=viewport.clientWidth/viewport.clientHeight;camera.updateProjectionMatrix();camera.position.copy(center).add(new THREE.Vector3(0, 0, size.y * 2)); controls.target.copy(center); frame(bounds,1.12); visibility(); progress.hidden = true; host.setAttribute('aria-busy', 'false'); host.dataset.ready = 'true';
  const api = {
    setDataMarkers(counts,selected){dataActive=counts!==null;
      const signature=JSON.stringify(counts);
      if(signature===markerSignature&&counts===null)return;
      markers.set(counts,selected);
      if(signature!==markerSignature){markerSignature=signature;visibility();}else markers.paint();
    },
    dataOrganStatus(id){const failed=host.dataset.organs==='error';return failed||loaded.has('organ')?markers.status(id,failed):'loading';},
    async setLayer(value){const task=++generation;await ensureLayer(value);if(task!==generation)return;if(!initialLayerApplied&&value===layer){initialLayerApplied=true;visibility();return;}initialLayerApplied=true;pickLabel.clear();layer=value;host.querySelector('#canvas-name').hidden=true;search.value='';fill();refreshAtlas();selected=null;lastHit=null;select.value='';delete host.dataset.selected;detail.textContent='Schicht gewechselt — Struktur wählen.';binding(null);visibility();},
    setOpacity(value){skinOpacity=value;skin.traverse(m=>{if(m.isMesh){const material=m.userData.skinMaterial;material.opacity=value*(economy?.48:.78);if(material.uniforms)material.uniforms.opacity.value=material.opacity;const face=m.userData.faceMaterial;face.opacity=value;face.transparent=value<1;face.depthWrite=value>=1;face.needsUpdate=true;}});render();},
    setLabels(value) {labelsOn = value; render();}, focusRegion() {},
    state() {return {sex: 'female', selected: selected?.id, quality: selected?.quality, bindingAllowed: femaleBindingAllowed(selected)&&Boolean(objects.get(selected?.id)?.object), hit: lastHit, layer, register: register.entries.length, skinOpacity, skinSide: THREE.FrontSide, viewProjection:new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).toArray(), visible:[...objects.values()].filter(a=>a.object?.visible).map(a=>a.entry.id), triangles: renderer.info.render.triangles, camera: camera.position.toArray(), target: controls.target.toArray()};},
    dispose() {pickLabel.dispose();disposeMotion();exampleMarker.dispose();stopOrgans();disposeStudio();resize.disconnect(); controls.dispose(); scene.traverse(m => {if (m.isMesh) {m.geometry.dispose();for(const mat of new Set([...(Array.isArray(m.material)?m.material:[m.material]),m.userData.skinMaterial,m.userData.outlineMaterial,m.userData.faceMaterial].filter(Boolean)))mat.dispose();}}); renderer.dispose();}
  };
  Object.defineProperty(host, 'avatarInventory', {value: () => [...objects.values()].map(a => ({id: a.entry.id, node: a.entry.source_node_index, name:a.entry.mesh, available:Boolean(a.layer),loaded:Boolean(a.object),visible:Boolean(a.object?.visible),triangles:a.triangles,materials:a.object?[{opacity:a.object.material.opacity,depthWrite:a.object.material.depthWrite,transparent:a.object.material.transparent}]:[]}))});
  Object.defineProperty(host, 'avatarState', {value: () => api.state()});
  Object.defineProperty(host,'avatarGeometry',{value:()=>{const rows=[];skin.updateWorldMatrix(true,true);skin.traverse(o=>{if(o.isMesh){const g=o.geometry,p=g.attributes.position,positions=[];for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i);o.localToWorld(v);positions.push(v.x,v.y,v.z);}rows.push({id:'female-a',positions,indices:g.index?Array.from(g.index.array):Array.from({length:p.count},(_,i)=>i)});}});return rows;}});
  const run=task=>task.catch(error=>{layerStatus.textContent='Diese Schicht konnte nicht geladen werden. Bitte erneut wählen.';});
  const changeLayer=value=>run(api.setLayer(value).then(()=>{if(matchMedia('(max-width:760px)').matches)viewport.scrollIntoView({block:'start'});}));
  for(const b of host.querySelectorAll('[data-layer]'))b.addEventListener('click',()=>changeLayer(b.dataset.layer));
  host.querySelector('#layer-peel').addEventListener('input',e=>run(api.setLayer(peelLayers[e.target.value])));
  for(const id of ['whole-body','canvas-reset'])host.querySelector('#'+id).addEventListener('click',()=>{selected=null;host.querySelector('#canvas-name').hidden=true;delete host.dataset.selected;binding(null);frame(bounds,1.12);visibility();});
  for(const term of ['Herz','Lunge','Leber','Niere','Gehirn','Darm']){host.querySelector('.quick-suggestions').append(button('female-idea-'+term,term,()=>{search.value=term;fill();refreshAtlas();}));}
  performance.mark('dht-glass-ready');
  const stopOrgans=organsAfterPaint({host,signal,ensureLayer,isSkin:()=>layer==='haut',refresh:visibility,render});
  replayPendingSelection(host,{setLayer:changeLayer});
  return api;
}
