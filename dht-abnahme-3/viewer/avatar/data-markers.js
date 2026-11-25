import {zaehlform} from '../eigene-daten/zaehlform.js';
/** Narrow optional renderer interface: presence only, no health evaluation. */
export function createDataMarkers({THREE, viewport, assets, manifest, camera, choose}) {
  const host = document.createElement('div'); host.className = 'data-organ-markers'; viewport.append(host);
  let counts = {}, active = false, picked, signature='';
  const saved=new Map();let background;
  const remember=m=>{if(!saved.has(m))saved.set(m,{color:m.color?.clone(),emissive:m.emissive?.clone(),emissiveIntensity:m.emissiveIntensity,opacity:m.opacity,transparent:m.transparent,depthWrite:m.depthWrite,vertexColors:m.vertexColors});};
  function set(value, selected) {
    counts = value || {}; active = value !== null; picked = selected;
    const next=JSON.stringify(value);if(active&&next===signature){for(const b of host.children)b.setAttribute('aria-pressed',String(b.dataset.dataOrgan===picked));return;}signature=next;host.replaceChildren();
    if(!active){if(background!==undefined){viewport.style.background=background;background=undefined;}for(const [m,v] of saved){if(v.color)m.color.copy(v.color);if(v.emissive)m.emissive.copy(v.emissive);for(const k of ['emissiveIntensity','opacity','transparent','depthWrite','vertexColors'])m[k]=v[k];if(m.uniforms?.opacity)m.uniforms.opacity.value=v.opacity;m.needsUpdate=true;}saved.clear();}
    if(!active)for(const a of assets.values())a.group.traverse(o=>{if(o.isMesh&&o.userData.dataVertexColors!==undefined){o.material.vertexColors=o.userData.dataVertexColors;o.material.needsUpdate=true;delete o.userData.dataVertexColors;}});
    for (const [id, count] of Object.entries(counts)) {
      const entry = manifest.entries.find(e => e.id === id); if (!entry) continue;
      const b = document.createElement('button'); b.type = 'button'; b.dataset.dataOrgan = id;
      const name = Array.isArray(entry.names.de) ? entry.names.de[0] : entry.names.de;
      b.dataset.label=`${name} · ${zaehlform(count,'Messreihe','Messreihen')}`;b.textContent = '•'; b.setAttribute('aria-label', `${name}: ${zaehlform(count,'Messreihe','Messreihen')}, Daten vorhanden`);
      b.title=`${name} · ${zaehlform(count,'Messreihe','Messreihen')}`;b.setAttribute('aria-pressed', String(id === picked)); b.addEventListener('click', () => choose(entry)); host.append(b);
    }
  }
  function paint() {
    if (!active) return;
    if(background===undefined)background=viewport.style.background;viewport.style.background='radial-gradient(ellipse at 45% 26%, #fffdf7 0%, #e2eeeb 57%, #c7dcdb 100%)';
    const files = new Set(Object.keys(counts).flatMap(id => manifest.entries.find(e => e.id === id)?.geometry || []));
    const selectedFiles = manifest.entries.find(e => e.id === picked)?.geometry || [];
    // The surrounding body shell is available from each loaded organ's parent.
    const body=assets.values().next().value?.group.parent;
    body?.traverse(o=>{if(o.isMesh&&o.userData.hull){remember(o.material);o.material.opacity=.10;if(o.material.uniforms?.opacity)o.material.uniforms.opacity.value=.10;o.material.transparent=true;o.material.depthWrite=false;}});
    for (const a of assets.values()) a.group.traverse(o => { if (o.isMesh && a.kind === 'organ') {
      remember(o.material);
      if(o.userData.dataVertexColors===undefined)o.userData.dataVertexColors=o.material.vertexColors;
      if(o.material.vertexColors){o.material.vertexColors=false;o.material.needsUpdate=true;}
      const present = files.has(a.file), selected = selectedFiles.includes(a.file);
      o.material.color.setHex(selected ? 0x63ded3 : (present ? 0xba8267 : 0x86979a));
      o.material.emissive.setHex(selected ? 0x178f88 : (present ? 0x523126 : 0)); o.material.emissiveIntensity = selected ? .65 : .15;
      // Solid foreground organs occlude their rear faces and interior segments.
      const solid = picked ? selected : present;
      o.material.opacity = solid ? 1 : (picked ? .24 : .08);
      o.material.transparent = !solid;
      o.material.depthWrite = solid;
    }});

    for (const b of host.children) {
      const e = manifest.entries.find(e => e.id === b.dataset.dataOrgan), box = new THREE.Box3();
      for (const file of e.geometry) { const a = assets.get(file); if (a?.group.visible) box.union(new THREE.Box3().setFromObject(a.group)); }
      b.hidden = box.isEmpty(); if (b.hidden) continue;
      const world = box.getCenter(new THREE.Vector3()); b.dataset.world = world.toArray().join(',');
      const p = world.project(camera);
      b.hidden = Math.abs(p.x) > 1 || Math.abs(p.y) > 1 || Math.abs(p.z) > 1; if (b.hidden) continue;
      const x = (p.x + 1) * viewport.clientWidth / 2;
      const y = (1 - p.y) * viewport.clientHeight / 2;
      b.dataset.labelSide=x>viewport.clientWidth/2?'left':'right';b.style.left = `${x}px`; b.style.top = `${y}px`;
    }
  }
  return {set, paint, get active(){return active;}};
}
