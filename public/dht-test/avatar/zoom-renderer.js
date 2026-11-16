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
  const m=s.meta.meshes[0],b=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
  const positions=new Float32Array(b,m.positionOffset,m.vertices*3),indices=new Uint16Array(b,m.indexOffset,m.indices);
  const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
  const software=/swiftshader|llvmpipe|softpipe|software/i.test(debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):'');
  const points=Array.from({length:m.vertices},(_,i)=>new THREE.Vector3(...positions.subarray(i*3,i*3+3)));
  const diameter=new THREE.Box3().setFromPoints(points).getSize(new THREE.Vector3()).length();
  // Index pairs define connectivity: never bridge a chain break.
  const chains=[];let chain=[];
  for(let i=0;i<indices.length;i+=2){const a=indices[i],z=indices[i+1];if(chain.at(-1)!==a){if(chain.length>1)chains.push(chain);chain=[a];}chain.push(z);}
  if(chain.length>1)chains.push(chain);
  group=new THREE.Group();
  for(const ids of chains){
   const segments=(ids.length-1)*(software?2:4),radial=software?5:8;
   const curve=new THREE.CatmullRomCurve3(ids.map(i=>points[i]),false,'centripetal');
   const geometry=new THREE.TubeGeometry(curve,segments,diameter*.012,radial,false);
   const colors=new Float32Array(geometry.attributes.position.count*3),color=new THREE.Color();
   for(let ring=0;ring<=segments;ring++){
    // Blue -> turquoise -> green -> yellow -> red, across the original chain order.
    const t=(ids[0]+(ids.at(-1)-ids[0])*ring/segments)/Math.max(1,m.vertices-1);
    color.setHSL((1-t)*2/3,1,.45);
    for(let j=0;j<=radial;j++)color.toArray(colors,(ring*(radial+1)+j)*3);
   }
   geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
   group.add(new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.45,metalness:0})));
  }
  renderer.domElement.dataset.software=String(software);
  renderer.domElement.dataset.radialSegments=String(software?5:8);

 }
 scene.add(group);const box=new THREE.Box3().setFromObject(group),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());if(box.isEmpty())throw Error('Leere Darstellung');
 group.position.sub(center);const radius=size.length()/2;
 function render(){renderer.render(scene,camera);}
 function resize(){const w=renderer.domElement.clientWidth,h=renderer.domElement.clientHeight;if(w<1||h<1)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.near=radius/1000;camera.far=radius*100;const distance=radius/Math.sin(THREE.MathUtils.degToRad(camera.fov/2))/Math.min(1,camera.aspect)*1.07;if(s.kind==='lines'){
   // Fit every tube vertex in the projected view with a 7% margin.
   const tan=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));let fit=0;
   group.updateMatrixWorld(true);group.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position,v=new THREE.Vector3();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);fit=Math.max(fit,v.z+Math.abs(v.x)*1.07/(tan*camera.aspect),v.z+Math.abs(v.y)*1.07/tan);}});
   camera.position.set(0,0,fit);
  }else camera.position.set(0,radius*.15,distance);camera.updateProjectionMatrix();controls.target.set(0,0,0);controls.update();render();}
 controls.addEventListener('change',render);const observer=new ResizeObserver(resize);observer.observe(renderer.domElement);
 let animation=0,last=0,turning=s.kind==='lines'&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
 const stop=()=>{turning=false;cancelAnimationFrame(animation);};
 const turn=now=>{if(!turning)return;if(last)group.rotation.y+=(now-last)/1000*.15;last=now;render();animation=requestAnimationFrame(turn);};
 const motion=matchMedia('(prefers-reduced-motion: reduce)'),motionChanged=()=>{if(motion.matches)stop();};motion.addEventListener('change',motionChanged);
 controls.addEventListener('start',stop);renderer.domElement.addEventListener('pointerdown',stop);renderer.domElement.addEventListener('wheel',stop,{passive:true});
 const key=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();stop();const d=camera.position.clone();d.applyAxisAngle(new THREE.Vector3(0,1,0),e.key==='ArrowLeft'?.2:-.2);camera.position.copy(d);controls.update();render();}};renderer.domElement.addEventListener('keydown',key);await new Promise(r=>requestAnimationFrame(r));resize();if(turning)animation=requestAnimationFrame(turn);
 return ()=>{stop();motion.removeEventListener('change',motionChanged);observer.disconnect();controls.dispose();decoder?.dispose();unstudio();const geometries=new Set(),materials=new Set();group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});for(const g of geometries)g.dispose();for(const m of materials){for(const v of Object.values(m))if(v?.isTexture)v.dispose();m.dispose();}renderer.dispose();renderer.forceContextLoss();};
 }catch(e){controls.dispose();decoder?.dispose();unstudio();renderer.dispose();renderer.forceContextLoss();throw e;}
}
