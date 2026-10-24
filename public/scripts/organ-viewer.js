import * as THREE from '../vendor/three/build/three.module.js';
import { GLTFLoader } from '../vendor/three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from '../vendor/three/examples/jsm/controls/OrbitControls.js';

export async function createViewer(element, reducedMotion) {
  const stage = element.querySelector('.organ-stage');
  const poster = element.querySelector('.organ-poster');
  const rotate = element.querySelector('[data-rotate]');
  const reset = element.querySelector('[data-reset]');
  const config = JSON.parse(element.dataset.camera);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor('#03132b');
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(config.fov_degrees, 1, config.near * 0.1, config.far * 10);
  camera.position.fromArray(config.position);
  camera.up.fromArray(config.up);
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `${element.dataset.name}: interaktives 3D-Modell. Pfeiltasten drehen, Plus und Minus zoomen, Pos1 setzt zurück.`);
  const controls = new OrbitControls(camera, canvas);
  controls.target.fromArray(config.target);
  controls.enablePan = false;
  controls.enableDamping = false;
  controls.autoRotateSpeed = 0.5;
  const distance = camera.position.distanceTo(controls.target);
  controls.minDistance = distance * 0.55;
  controls.maxDistance = distance * 2;
  controls.update();
  controls.saveState();
  scene.add(new THREE.HemisphereLight(0xd9f7ff, 0x304062, 2.5));
  const key = new THREE.DirectionalLight(0xffffff, 3);
  key.position.set(2, 3, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x53cfff, 2);
  fill.position.set(-2, 1, -3);
  scene.add(fill);
  let draco;
  let model;
  try {
    const loader = new GLTFLoader();
    if (element.dataset.model.includes('carotis-')) {
      const { DRACOLoader } = await import('../vendor/three/examples/jsm/loaders/DRACOLoader.js');
      draco = new DRACOLoader();
      draco.setDecoderPath('/vendor/three/examples/jsm/libs/draco/gltf/');
      draco.setDecoderConfig({ type: 'wasm' });
      draco.setWorkerLimit(1);
      loader.setDRACOLoader(draco);
    } else {
      const { MeshoptDecoder } = await import('../vendor/three/examples/jsm/libs/meshopt_decoder.module.js');
      loader.setMeshoptDecoder(MeshoptDecoder);
    }
    model = (await loader.loadAsync(element.dataset.model)).scene;
    scene.add(model);
  } catch (error) {
    controls.dispose();
    renderer.dispose();
    throw error;
  } finally {
    draco?.dispose();
  }
  stage.append(canvas);
  poster.hidden = true;
  let visible = false;
  let rotating = !reducedMotion.matches;
  let frame = 0;
  let previous = 0;
  const render = () => renderer.render(scene, camera);
  const resize = () => {
    renderer.setSize(stage.clientWidth, stage.clientHeight, false);
    camera.aspect = stage.clientWidth / stage.clientHeight;
    camera.updateProjectionMatrix();
    render();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  function tick(time) {
    controls.update(previous ? Math.min((time - previous) / 1000, 0.05) : 0);
    previous = time;
    render();
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame);
    previous = 0;
    controls.autoRotate = rotating && !reducedMotion.matches;
    rotate.textContent = controls.autoRotate ? 'Rotation pausieren' : 'Rotation starten';
    rotate.setAttribute('aria-pressed', String(controls.autoRotate));
    rotate.disabled = reducedMotion.matches;
    rotate.title = reducedMotion.matches ? 'Automatische Bewegung ist in Deinen Systemeinstellungen reduziert.' : '';
    if (visible && controls.autoRotate) frame = requestAnimationFrame(tick);
    render();
  }
  rotate.hidden = false;
  reset.hidden = false;
  rotate.addEventListener('click', () => { rotating = !rotating; sync(); });
  reset.addEventListener('click', () => { controls.reset(); render(); });
  reducedMotion.addEventListener('change', sync);
  controls.addEventListener('change', render);
  controls.addEventListener('start', () => { rotating = false; sync(); });
  canvas.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', 'Home'].includes(event.key)) return;
    event.preventDefault();
    rotating = false;
    if (event.key === 'Home') controls.reset();
    else {
      const offset = camera.position.clone().sub(controls.target);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      if (event.key === 'ArrowLeft') spherical.theta -= 0.12;
      if (event.key === 'ArrowRight') spherical.theta += 0.12;
      if (event.key === 'ArrowUp') spherical.phi -= 0.12;
      if (event.key === 'ArrowDown') spherical.phi += 0.12;
      if (event.key === '+' || event.key === '=') spherical.radius *= 0.9;
      if (event.key === '-') spherical.radius *= 1.1;
      spherical.makeSafe();
      spherical.radius = THREE.MathUtils.clamp(spherical.radius, controls.minDistance, controls.maxDistance);
      camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
      controls.update();
    }
    sync();
  });
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    visible = false;
    cancelAnimationFrame(frame);
    poster.hidden = false;
    element.querySelector('.organ-status').textContent = '3D wurde unterbrochen. Das Bild bleibt verfügbar; bitte lade die Seite neu.';
  });
  resize();
  sync();
  return { setVisible(value) { visible = value; sync(); } };
}
