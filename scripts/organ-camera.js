import * as THREE from '../vendor/three/build/three.module.js';

// web_export.py prefixes nodes with source_index:node_index:original_name.
// Source 0 is the organ; source 1 contains HRA attachment vessels.
export function organBounds(model, framing) {
  if (!framing || framing.source_index !== 0) throw new Error('Missing organ framing metadata');
  const box = new THREE.Box3();
  model.updateWorldMatrix(true, true);
  model.traverse((mesh) => {
    if (!mesh.isMesh) return;
    let node = mesh;
    while (node && !/^\d+:\d+:/.test(node.userData.name || '')) node = node.parent;
    const match = node?.userData.name?.match(/^(\d+):\d+:(.*)$/);
    if (!match || Number(match[1]) !== framing.source_index) return;
    if (framing.structures && !framing.structures.includes(match[2])) return;
    if (node.userData.x5?.default_visible === false) return;
    mesh.geometry.computeBoundingBox();
    box.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld));
  });
  if (box.isEmpty()) throw new Error('No organ meshes found for camera framing');
  return box;
}

export function organCamera(box, fullBox, config, aspect) {
  if (!(aspect > 0) || !Number.isFinite(aspect)) throw new Error('Invalid camera aspect');
  const anterior = config.axes?.anterior;
  if (!['+z', '-z'].includes(anterior)) throw new Error('Unknown anterior axis');
  const size = box.getSize(new THREE.Vector3());
  if (box.isEmpty() || !(size.length() > 0)) throw new Error('Empty organ bounds');
  const target = box.getCenter(new THREE.Vector3());
  const tangent = Math.tan(THREE.MathUtils.degToRad(config.fov_degrees / 2));
  // Include the nearest box face: the projected box fills 65% on its limiting axis.
  const distance = size.z / 2 + Math.max(size.y, size.x / aspect) / (2 * tangent * 0.65);
  const position = target.clone().add(new THREE.Vector3(0, 0, anterior === '+z' ? distance : -distance));
  const extent = fullBox.getSize(new THREE.Vector3()).length();
  return {
    target, position, distance,
    minDistance: distance * 0.08,
    maxDistance: Math.max(distance * 4, extent * 3),
    near: Math.max(size.length() * 0.0001, 0.000001),
    far: Math.max(distance * 8, extent * 8),
  };
}
