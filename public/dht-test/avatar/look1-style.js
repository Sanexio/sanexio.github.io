/** LOOK1 baked surface loader. RGB8 is linear, bound to original primitive counts. */
import * as THREE from 'three';
export function studio(renderer,scene,viewport,{economy=false}={}){
 if(economy){
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;renderer.setClearColor(0x000000,0);
  scene.add(new THREE.HemisphereLight(0xf4f9ff,0x989494,1.6));
  const key=new THREE.DirectionalLight(0xffe8d8,2.2);key.position.set(-2,3,4);scene.add(key);
  return ()=>{scene.remove(key);};
 }
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
 renderer.setClearColor(0x000000,0);viewport.style.background='radial-gradient(ellipse at 45% 26%, #ffffff 0%, #e2edf0 57%, #c5d8df 100%)';
 scene.add(new THREE.HemisphereLight(0xf4f9ff,0x989494,1.6));
 for(const [color,intensity,position] of [[0xffe8d8,2.2,[-2,3,4]],[0xd7efff,1.05,[3,1,2]],[0xb5e7ff,2.4,[1,2,-3]]]){const l=new THREE.DirectionalLight(color,intensity);l.position.set(...position);scene.add(l);}
 // Procedural contact ellipse, no geometry: background layer stays fixed below canvas.
 const shadow=document.createElement('div');shadow.className='look1-contact';shadow.style.cssText='pointer-events:none;position:absolute;left:33%;right:33%;bottom:4%;height:4%;border-radius:50%;background:radial-gradient(ellipse,rgba(35,68,84,.23),rgba(35,68,84,0) 70%);filter:blur(5px)';viewport.prepend(shadow);
 return ()=>shadow.remove();
}
export function outlineMaterial(economy=false,skin=false){
 const opacity=skin?(economy?.48:.78):(economy?.10:.18);
 if(economy)return new THREE.MeshBasicMaterial({color:skin?0x258ec6:0x1a6ba1,transparent:true,opacity,depthWrite:false,side:THREE.FrontSide});
 return new THREE.ShaderMaterial({transparent:true,opacity,depthWrite:false,side:THREE.FrontSide,uniforms:{opacity:{value:opacity},fill:{value:skin?.32:.14}},vertexShader:`varying vec3 N;varying vec3 V;void main(){vec4 p=modelViewMatrix*vec4(position,1.);N=normalize(normalMatrix*normal);V=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`,fragmentShader:`varying vec3 N;varying vec3 V;uniform float opacity;uniform float fill;void main(){float rim=pow(1.-abs(dot(normalize(N),normalize(V))),2.3);gl_FragColor=vec4(.10,.42,.63,opacity*(fill+(1.-fill)*rim));
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});
}
export async function bakedSurfaces(base,signal){
 const descriptor=await(await fetch(new URL('look1.json',base),{signal})).json(),cache=new Map();
 const digest=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('');
 async function load(layer){if(!cache.has(layer))cache.set(layer,(async()=>{const spec=descriptor.packs[layer],r=await fetch(new URL(spec.file,base),{signal});if(!r.ok)throw Error('Oberfläche fehlt');const b=await r.arrayBuffer();if(b.byteLength!==spec.bytes||await digest(b)!==spec.sha256)throw Error('Oberflächen-Prüfsumme abweichend');if(spec.encoding==='gzip'){const decoded=await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();if(decoded.byteLength!==spec.decodedBytes||decoded.byteLength>16000000)throw Error('Oberflächenumfang abweichend');return decoded;}return b;})().catch(error=>{cache.delete(layer);throw error;}));return cache.get(layer);}
 function apply(group,file,buffer,sourceSha){const row=descriptor.rows[file];if(!row||row.source_sha256!==sourceSha)throw Error('Oberflächen-Quellbindung abweichend');let offset=row.offset,i=0;group.traverse(o=>{if(!o.isMesh)return;const count=o.geometry.attributes.position.count;if(row.counts[i++]!==count)throw Error('Oberflächen-Vertexbindung abweichend');o.geometry.setAttribute('color',new THREE.BufferAttribute(new Uint8Array(buffer,offset,count*3),3,true));offset+=count*3;
 if(file==='skin'){const d=new Int8Array(buffer,offset,count*3),p=o.geometry.attributes.position;for(let j=0;j<count;j++)p.setXYZ(j,p.getX(j)+d[j*3]/127*.0015,p.getY(j)+d[j*3+1]/127*.0015,p.getZ(j)+d[j*3+2]/127*.0015);p.needsUpdate=true;offset+=count*3;}
 });if(i!==row.counts.length||offset!==row.offset+row.bytes)throw Error('Oberflächenumfang abweichend');}
 return {load,apply};
}
