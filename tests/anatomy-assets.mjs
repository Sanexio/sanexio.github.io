import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { MeshoptDecoder } from '../public/vendor/three/examples/jsm/libs/meshopt_decoder.module.js';
const models = JSON.parse(await readFile('src/data/anatomy.json', 'utf8'));
await MeshoptDecoder.ready;
const decoderSource = await readFile('public/vendor/three/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js', 'utf8');
const sandbox = { module: { exports: {} }, WebAssembly, console, TextDecoder, TextEncoder, setTimeout, clearTimeout };
vm.runInNewContext(decoderSource, sandbox);
const draco = await sandbox.DracoDecoderModule({ wasmBinary: await readFile('public/vendor/three/examples/jsm/libs/draco/gltf/draco_decoder.wasm') });
let meshCount = 0;
for (const [id, metadata] of Object.entries(models)) {
  const bytes = await readFile(`public/anatomy/${id}-mobil.glb`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), metadata.sha256);
  const length = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + length));
  const binary = bytes.subarray(28 + length);
  for (const view of gltf.bufferViews || []) {
    const compressed = view.extensions?.EXT_meshopt_compression;
    if (!compressed) continue;
    const source = binary.subarray(compressed.byteOffset || 0, (compressed.byteOffset || 0) + compressed.byteLength);
    const target = new Uint8Array(compressed.count * compressed.byteStride);
    MeshoptDecoder.decodeGltfBuffer(target, compressed.count, compressed.byteStride, source, compressed.mode, compressed.filter);
  }
  for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) {
    meshCount++;
    const compressed = primitive.extensions?.KHR_draco_mesh_compression;
    if (!compressed) continue;
    const view = gltf.bufferViews[compressed.bufferView];
    const source = binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
    const decoder = new draco.Decoder();
    const buffer = new draco.DecoderBuffer();
    const decoded = new draco.Mesh();
    buffer.Init(new Int8Array(source), source.length);
    const status = decoder.DecodeBufferToMesh(buffer, decoded);
    assert(status.ok(), `${id}: ${status.error_msg()}`);
    assert(decoded.num_points() > 0);
    draco.destroy(decoded); draco.destroy(buffer); draco.destroy(decoder);
  }
  console.log(`PASS decode/hash: ${id} (${bytes.length} bytes)`);
}
for (const [slug, count] of Object.entries({
  'digital-health-twin-unsere-idee': 3, 'werkstattbericht-3d-organe-schritt-fuer-schritt': 6,
  'mitbauen-wie-nutzer-den-dht-mitgestalten': 2, 'health-graph-engine-des-dht': 3,
})) {
  const html = await readFile(`dist/blog/${slug}/index.html`, 'utf8');
  const json = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/s);
  const graph = JSON.parse(json[1])['@graph'];
  assert.equal(graph.filter(x => x['@type'] === '3DModel').length, count);
  assert.equal(graph.filter(x => x['@type'] === 'ImageObject').length, count);
  for (const entry of graph) { assert(entry.creditText); assert(entry.license.startsWith('https://')); }
  assert(html.includes('property="og:image:alt"'));
  assert(!html.includes('modulepreload'));
  assert(!/<script[^>]+src="[^"]*vendor/.test(html));
  if (slug.startsWith('health-graph')) assert(html.includes('/images/blog/healthgraph-panel-1440.jpg'));
}
console.log(`PASS: ${meshCount} mesh primitives, 4 article schemas, OG alt, no eager vendor preload, original image preserved.`);
