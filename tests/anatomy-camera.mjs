import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from '../public/vendor/three/build/three.module.js';
import { GLTFLoader } from '../public/vendor/three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from '../public/vendor/three/examples/jsm/libs/meshopt_decoder.module.js';
import { organBounds, organCamera } from '../public/scripts/organ-camera.js';

const models = JSON.parse(await readFile('src/data/anatomy.json', 'utf8'));
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
function projectionFill(box, fit, config, aspect) {
  const camera = new THREE.PerspectiveCamera(config.fov_degrees, aspect, fit.near, fit.far);
  camera.position.copy(fit.position);
  camera.up.fromArray(config.up);
  camera.lookAt(fit.target);
  camera.updateMatrixWorld();
  const projected = new THREE.Box3();
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const point = new THREE.Vector3(x, y, z).project(camera);
    assert(point.z > -1 && point.z < 1, 'Organ lies inside clipping planes');
    projected.expandByPoint(point);
  }
  const size = projected.getSize(new THREE.Vector3());
  return Math.max(size.x, size.y) / 2;
}
function boxMesh(name, min, max) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([...min, ...max], 3));
  const mesh = new THREE.Mesh(geometry);
  mesh.userData.name = name;
  return mesh;
}

for (const [id, { camera: config }] of Object.entries(models)) {
  const bytes = await readFile(`public/anatomy/${id}-mobil.glb`);
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
  let model;
  if (id.startsWith('carotis')) {
    // Actual Draco decoding is covered by anatomy-assets; use exported POSITION bounds here.
    model = new THREE.Group();
    for (const node of gltf.nodes) {
      assert(!node.matrix && !node.translation && !node.rotation && !node.scale);
      for (const primitive of gltf.meshes[node.mesh]?.primitives || []) {
        const accessor = gltf.accessors[primitive.attributes.POSITION];
        model.add(boxMesh(node.name, accessor.min, accessor.max));
      }
    }
  } else {
    model = (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
  }
  const box = organBounds(model, config.framing);
  const full = new THREE.Box3().setFromObject(model);
  for (const aspect of [0.5, 1, 1.8]) {
    const fit = organCamera(box, full, config, aspect);
    assert(Math.abs(projectionFill(box, fit, config, aspect) - 0.65) < 1e-6, `${id}: 65% projected organ box`);
    assert.equal(Math.sign(fit.position.z - fit.target.z), id.startsWith('carotis') || id.startsWith('schild') ? -1 : 1);
    assert(fit.minDistance < fit.distance * 0.1);
    assert(fit.maxDistance >= fit.distance * 4);
  }
  // An arbitrarily long attachment must not move the organ target or change its scale.
  const before = organCamera(box, full, config, 1);
  model.add(boxMesh('1:999:VH_M_inferior_vena_cava_a', [-1, -100, -1], [1, 100, 1]));
  const after = organCamera(organBounds(model, config.framing), new THREE.Box3().setFromObject(model), config, 1);
  assert.deepEqual(after.position, before.position);
  assert.deepEqual(after.target, before.target);
  if (config.framing.structures) {
    model.add(boxMesh('0:999:Cartilago_thyroidea', [-100, -100, -100], [100, 100, 100]));
    assert.deepEqual(organBounds(model, config.framing), box, `${id}: SPL context cannot affect framing`);
  }
  if (id === 'herz-male') {
    assert(box.getSize(new THREE.Vector3()).y < full.getSize(new THREE.Vector3()).y * 0.6, 'Heart frame excludes the real long vena cava');
    assert(before.distance < new THREE.Vector3(...config.position).distanceTo(new THREE.Vector3(...config.target)) * 0.7);
  }
  console.log(`PASS organ camera: ${id}, portrait/square/landscape, anterior, vessel exclusion`);
}

// World transforms, multi-primitive children and hidden targets must be handled explicitly.
const model = new THREE.Group();
const organ = new THREE.Group();
organ.userData.name = '0:0:organ';
organ.position.set(10, 20, 30);
organ.scale.setScalar(2);
organ.add(boxMesh('', [-1, -1, -1], [1, 1, 1]));
model.add(organ);
const hidden = boxMesh('0:1:hidden', [-100, -100, -100], [100, 100, 100]);
hidden.userData.x5 = { default_visible: false };
model.add(hidden);
const box = organBounds(model, { source_index: 0 });
assert.deepEqual(box.min.toArray(), [8, 18, 28]);
assert.deepEqual(box.max.toArray(), [12, 22, 32]);
assert.throws(() => organBounds(model, { source_index: 0, structures: ['missing'] }), /No organ meshes/);
assert.throws(() => organBounds(model), /Missing organ/);
assert.throws(() => organCamera(box, box, models['herz-male'].camera, 0), /Invalid camera aspect/);
console.log('PASS transformed meshes, hidden targets, missing mapping and invalid aspect');
