import * as THREE from 'three';
import {GLTFLoader} from './vendor/loaders/GLTFLoader.js';
import {DRACOLoader} from './vendor/loaders/DRACOLoader.js';
import {OrbitControls} from './vendor/controls/OrbitControls.js';
import {studio} from './look1-style.js';
export async function drawZoom(host,s,bytes){
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.domElement.id='zoom-canvas';renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label',s.title+' · ziehen zum Drehen');host.append(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,1,.001,1000),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;
 const unstudio=studio(renderer,scene,host);let group,decoder;
 try{
 if(s.kind==='glb'){
  const loader=new GLTFLoader();decoder=new DRACOLoader().setDecoderPath(new URL('vendor/draco/',import.meta.url).href);loader.setDRACOLoader(decoder);
  group=(await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),new URL('zoom/',import.meta.url).href)).scene;
  // The existing haemoglobin representation shares atom meshes. Batch identical pairs.
  const groups=new Map();group.updateMatrixWorld(true);group.traverse(o=>{if(o.isMesh){const key=o.geometry.uuid+'/'+o.material.uuid;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(o);}});
  if(s.file==='haemoglobin.glb'){
   const batched=new THREE.Group();for(const objects of groups.values()){const first=objects[0],mesh=new THREE.InstancedMesh(first.geometry,first.material,objects.length);objects.forEach((o,i)=>mesh.setMatrixAt(i,o.matrixWorld));mesh.instanceMatrix.needsUpdate=true;batched.add(mesh);}group=batched;
  }
 }else{
  const m=s.meta.meshes[0],b=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(b,m.positionOffset,m.vertices*3),3));geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(b,m.indexOffset,m.indices),1));const positions=geometry.attributes.position,colors=new Float32Array(m.vertices*3),base=new THREE.Color(0xc64e42);for(let i=0;i<m.vertices;i++){const shade=.55+.45*(positions.getZ(i)-s.meta.min[2])/(s.meta.max[2]-s.meta.min[2]);colors[i*3]=base.r*shade;colors[i*3+1]=base.g*shade;colors[i*3+2]=base.b*shade;}geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));group=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({vertexColors:true}));
 }
 scene.add(group);const box=new THREE.Box3().setFromObject(group),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());if(box.isEmpty())throw Error('Leere Darstellung');
 group.position.sub(center);const radius=size.length()/2;
 function render(){renderer.render(scene,camera);}
 function resize(){const w=renderer.domElement.clientWidth,h=renderer.domElement.clientHeight;if(w<1||h<1)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.near=radius/1000;camera.far=radius*100;const distance=radius/Math.sin(THREE.MathUtils.degToRad(camera.fov/2))/Math.min(1,camera.aspect)*1.07;camera.position.set(0,radius*.15,distance);camera.updateProjectionMatrix();controls.target.set(0,0,0);controls.update();render();}
 controls.addEventListener('change',render);const observer=new ResizeObserver(resize);observer.observe(renderer.domElement);
 const key=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const d=camera.position.clone();d.applyAxisAngle(new THREE.Vector3(0,1,0),e.key==='ArrowLeft'?.2:-.2);camera.position.copy(d);controls.update();render();}};renderer.domElement.addEventListener('keydown',key);await new Promise(r=>requestAnimationFrame(r));resize();
 return ()=>{observer.disconnect();controls.dispose();decoder?.dispose();unstudio();const geometries=new Set(),materials=new Set();group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});for(const g of geometries)g.dispose();for(const m of materials){for(const v of Object.values(m))if(v?.isTexture)v.dispose();m.dispose();}renderer.dispose();renderer.forceContextLoss();};
 }catch(e){controls.dispose();decoder?.dispose();unstudio();renderer.dispose();renderer.forceContextLoss();throw e;}
}
