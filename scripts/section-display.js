/* Schnittansicht: opaker Clip + gläserne Ergänzung (S28). */
import * as THREE from '../vendor/three/build/three.module.js';

export const SUPPLEMENT_ALPHA = 0.08;
const FRESNEL_COLOR = new THREE.Color('#10E3E7');

export function sectionHalfSpace(section, box) {
  const n = new THREE.Vector3(...section.normal_gltf).normalize();
  const min = box.min.clone();
  const max = box.max.clone();
  const corners = [
    new THREE.Vector3(min.x, min.y, min.z),
    new THREE.Vector3(min.x, min.y, max.z),
    new THREE.Vector3(min.x, max.y, min.z),
    new THREE.Vector3(min.x, max.y, max.z),
    new THREE.Vector3(max.x, min.y, min.z),
    new THREE.Vector3(max.x, min.y, max.z),
    new THREE.Vector3(max.x, max.y, min.z),
    new THREE.Vector3(max.x, max.y, max.z),
  ];
  let lo = Infinity;
  let hi = -Infinity;
  for (const c of corners) {
    const d = n.dot(c);
    lo = Math.min(lo, d);
    hi = Math.max(hi, d);
  }
  const offset = lo + (hi - lo) * section.fraction;
  const keepPlane = new THREE.Plane();
  keepPlane.normal.copy(n);
  keepPlane.constant = -offset;
  const discardPlane = keepPlane.clone().negate();
  return { keepPlane, discardPlane };
}

function applyFresnelRim(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uFresnelColor = { value: FRESNEL_COLOR };
    shader.uniforms.uFresnelBoost = { value: 1.2 };
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <output_fragment>',
      `
      float fresnel = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.5);
      diffuseColor.rgb += uFresnelColor * fresnel * uFresnelBoost;
      #include <output_fragment>
      `
    );
  };
  material.customProgramCacheKey = () => 's28-supplement-rim';
}

function cloneMaterialForSupplement(material) {
  const base = material.clone();
  base.transparent = true;
  base.opacity = SUPPLEMENT_ALPHA;
  base.depthWrite = false;
  base.side = THREE.FrontSide;
  base.emissive = FRESNEL_COLOR.clone();
  base.emissiveIntensity = 0;
  applyFresnelRim(base);
  return base;
}

export function buildSectionRoots(gltfScene) {
  const opaqueRoot = new THREE.Group();
  const supplementRoot = new THREE.Group();
  gltfScene.traverse((obj) => {
    if (!obj.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    const opaqueMats = mats.map((m) => {
      const c = m.clone();
      c.side = THREE.DoubleSide;
      c.transparent = false;
      c.depthWrite = true;
      return c;
    });
    const supplementMats = mats.map((m) => cloneMaterialForSupplement(m));
    const opaqueMesh = obj.clone();
    opaqueMesh.material = Array.isArray(obj.material) ? opaqueMats : opaqueMats[0];
    const supplementMesh = obj.clone();
    supplementMesh.material = Array.isArray(obj.material) ? supplementMats : supplementMats[0];
    opaqueRoot.add(opaqueMesh);
    supplementRoot.add(supplementMesh);
  });
  supplementRoot.visible = false;
  const root = new THREE.Group();
  root.add(opaqueRoot, supplementRoot);
  return { root, opaqueRoot, supplementRoot };
}

export function sectionEnabled(section) {
  return !!(section && section.enabled && Array.isArray(section.normal_gltf) && section.normal_gltf.length === 3);
}

export function applySectionViewMode(state, mode) {
  const cut = mode === 'schnitt' && sectionEnabled(state.section);
  state.viewMode = cut ? 'schnitt' : 'normal';
  state.supplementRoot.visible = cut;
  state.opaqueRoot.traverse((obj) => {
    if (!obj.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((m) => {
      m.clippingPlanes = cut && state.clip ? [state.clip.keepPlane] : null;
      m.clipShadows = true;
      m.needsUpdate = true;
    });
  });
  state.supplementRoot.traverse((obj) => {
    if (!obj.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((m) => {
      m.clippingPlanes = cut && state.clip ? [state.clip.discardPlane] : null;
      m.needsUpdate = true;
    });
  });
}

export function recomputeSectionClip(state) {
  if (!sectionEnabled(state.section)) {
    state.clip = null;
    applySectionViewMode(state, 'normal');
    return;
  }
  const box = new THREE.Box3().setFromObject(state.opaqueRoot);
  state.clip = sectionHalfSpace(state.section, box);
  applySectionViewMode(state, state.viewMode);
}
