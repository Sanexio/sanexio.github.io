import * as THREE from 'three';
import { OrbitControls } from './vendor/controls/OrbitControls.js';

// A separate scene. Camera framing changes no vertex or atlas coordinates.
export function referenceView(host, id) {
  const canvas=document.createElement('canvas');canvas.id=id;canvas.style.cssText='width:100%;height:480px;display:block';host.append(canvas);
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});renderer.setClearColor(0xeaf0f3);
  const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(35,1,.001,100000);
  const controls=new OrbitControls(camera,canvas);controls.enableDamping=false;
  scene.add(new THREE.HemisphereLight(0xffffff,0x536475,2.5));
  const light=new THREE.DirectionalLight(0xffffff,2.5);light.position.set(3,5,7);scene.add(light);
  let object;
  const draw=()=>renderer.render(scene,camera);
  const resize=()=>{const w=canvas.clientWidth||640;renderer.setSize(w,480,false);camera.aspect=w/480;camera.updateProjectionMatrix();draw();};
  const observer=new ResizeObserver(resize);observer.observe(canvas);controls.addEventListener('change',draw);
  const reset=()=>{if(!object)return;const box=new THREE.Box3().setFromObject(object),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());const radius=Math.max(size.y,size.x/camera.aspect,size.z,.01);controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(0,0,radius*2));camera.far=Math.max(100,radius*20);camera.updateProjectionMatrix();controls.update();draw();};
  return {set(next){if(object&&object!==next){scene.remove(object);object.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of (Array.isArray(o.material)?o.material:[o.material]))m.dispose();}});}object=next;scene.add(next);resize();reset();},draw,reset,dispose(){observer.disconnect();controls.dispose();renderer.dispose();},canvas};
}
