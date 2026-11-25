import {DRACOLoader} from '../vendor/loaders/DRACOLoader.js';
import {GLTFLoader} from '../vendor/loaders/GLTFLoader.js';
import {pack, vessels, vesselPath} from './katalog.js';

function dispose(scene) {
  const materials = new Set();
  scene.traverse(o => {
    if (!o.isMesh) return;
    o.geometry.dispose();
    for (const material of [].concat(o.material)) materials.add(material);
  });
  for (const material of materials) material.dispose();
}

async function decode(bytes, signal) {
  const draco = new DRACOLoader()
    .setDecoderPath(new URL('../vendor/draco/', import.meta.url).href)
    .setWorkerLimit(2);
  const loader = new GLTFLoader().setDRACOLoader(draco);
  let timedOut = false, timer, abort;
  try {
    const cancellation = new Promise((_, reject) => {
      abort = () => reject(signal.reason);
      signal?.addEventListener('abort', abort, {once: true});
      timer = setTimeout(() => {
        timedOut = true;
        reject(Error('Gefäßsystem konnte nicht dekodiert werden.'));
      }, 15000);
    });
    const parsed = loader.parseAsync(bytes, '').then(result => {
      if (signal?.aborted || timedOut) dispose(result.scene);
      return result;
    });
    return await Promise.race([parsed, cancellation]);
  } finally {
    signal?.removeEventListener('abort', abort);
    clearTimeout(timer);
    draco.dispose();
  }
}

export async function loadVessels({download, digest, signal}) {
  const bytes = await download('gefaesse/' + pack.file, 'Gefäßsystem wird geladen', pack.bytes);
  if (bytes.byteLength !== pack.bytes || await digest(bytes) !== pack.sha256) {
    throw Error('Gefäßsystem-Prüfsumme abweichend.');
  }
  signal?.throwIfAborted();
  const {scene} = await decode(bytes, signal);
  try {
    signal?.throwIfAborted();
    const meshes = new Map(scene.children.map(o => [o.userData.source_object, o]));
    if (meshes.size !== vessels.length || scene.children.length !== vessels.length) {
      throw Error('Gefäßinventar abweichend.');
    }
    const assets = vessels.map(([key, source, material, triangles]) => {
      const mesh = meshes.get(source);
      if (!mesh?.isMesh || mesh.children.length || mesh.geometry.index?.count !== 3 * triangles ||
          mesh.material.name !== material || mesh.position.lengthSq() !== 0 ||
          mesh.quaternion.x !== 0 || mesh.quaternion.y !== 0 || mesh.quaternion.z !== 0 ||
          mesh.quaternion.w !== 1 || mesh.scale.x !== 1 || mesh.scale.y !== 1 || mesh.scale.z !== 1) {
        throw Error('Gefäßbindung abweichend: ' + source);
      }
      return {file: vesselPath(key), kind: 'vessel', group: mesh, triangles};
    });
    // GLTFLoader shares source materials. Each selectable vessel needs its own highlight.
    const sourceMaterials = new Set(assets.map(asset => asset.group.material));
    for (const asset of assets) {
      const mesh = asset.group;
      mesh.material = mesh.material.clone();
      mesh.userData.baseColor = mesh.material.color.clone();
      mesh.userData.asset = asset;
    }
    for (const material of sourceMaterials) material.dispose();
    return assets;
  } catch (error) {
    dispose(scene);
    throw error;
  }
}
