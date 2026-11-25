/** Shared camera interaction: the body and every geometry anchor use one camera. */
export function dashboardMotion({THREE,host,viewport,canvas,camera,controls,actions,render}){
 const button=document.createElement('button');button.type='button';button.id='avatar-grab';button.className='secondary';button.textContent='✋ Verschieben';button.setAttribute('aria-pressed','false');button.title='Verschieben einschalten, dann die Figur ziehen. Pfeiltasten verschieben; Esc beendet.';
 actions.prepend(button);let grabbing=false;
 const reset=document.createElement('button');reset.type='button';reset.id='avatar-motion-reset';reset.className='secondary';reset.textContent='Zurücksetzen';reset.title='Ansicht der ganzen Figur zurücksetzen';button.after(reset);
 const resetView=()=>host.querySelector('#avatar-body')?.click();reset.addEventListener('click',resetView);
 const left=controls.mouseButtons.LEFT,one=controls.touches.ONE;
 const change=value=>{grabbing=value;button.setAttribute('aria-pressed',String(value));controls.mouseButtons.LEFT=value?THREE.MOUSE.PAN:left;controls.touches.ONE=value?THREE.TOUCH.PAN:one;viewport.dataset.grab=String(value);canvas.setAttribute('aria-label',(host.dataset.sex==='female'?'Weiblicher':'DHT')+' 3D-Körper; '+(value?'ziehen zum Verschieben, Pfeiltasten verschieben, Escape beendet':'ziehen zum Drehen, Rad zum Zoomen'));};
 button.addEventListener('click',()=>change(!grabbing));
 function key(e){
  if(!grabbing)return;
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();change(false);button.focus({preventScroll:true});return;}
  const delta={ArrowLeft:[-36,0],ArrowRight:[36,0],ArrowUp:[0,-36],ArrowDown:[0,36]}[e.key];if(!delta)return;
  e.preventDefault();e.stopImmediatePropagation();camera.updateMatrixWorld(true);
  const scale=2*camera.position.distanceTo(controls.target)*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/Math.max(1,viewport.clientHeight);
  const offset=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0).multiplyScalar(-delta[0]*scale).addScaledVector(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1),delta[1]*scale);
  camera.position.add(offset);controls.target.add(offset);controls.update();render();
 }
 canvas.addEventListener('keydown',key,true);
 return ()=>{canvas.removeEventListener('keydown',key,true);reset.removeEventListener('click',resetView);reset.remove();button.remove();};
}

export function dashboardContext({host,camera,controls,bodyHeight,layer,selected,name}){
 const distance=camera.position.distanceTo(controls.target),ratio=bodyHeight/Math.max(distance,.00001);
 const scope=ratio<.85?'Übersicht':selected?'Struktur':'Ausschnitt';
 const title=scope==='Übersicht'?'Ganzer Körper':selected?name:'Strukturausschnitt';
 const signature=[scope,title,layer].join('|');if(host.dataset.contextSignature===signature)return;
 host.dataset.contextSignature=signature;host.dataset.zoomScope=scope;
 host.dispatchEvent(new CustomEvent('avatar-context',{bubbles:true,detail:{scope,title,layer,selected}}));
}

/** The example's location comes exclusively from an actually drawn mesh. */
export function layerExampleMarker({THREE,host,viewport,camera,enabled,anchor}){
 const box=new THREE.Box3(),point=new THREE.Vector3();
 const button=document.createElement('button');button.type='button';button.className='dashboard-example-marker';button.hidden=true;button.textContent='•';viewport.append(button);
 let current;
 button.addEventListener('click',()=>{if(current)host.dispatchEvent(new CustomEvent('dashboard-example',{bubbles:true,detail:current}));});
 return {paint(){
  current=enabled()?anchor():null;button.hidden=!current;if(!current)return;
  if(current.point){current.point(point);}else{box.setFromObject(current.object);if(box.isEmpty()){button.hidden=true;return;}box.getCenter(point);}
  button.dataset.world=point.toArray().join(',');point.project(camera);
  button.hidden=Math.abs(point.x)>1||Math.abs(point.y)>1||Math.abs(point.z)>1;if(button.hidden)return;
  button.dataset.exampleLayer=current.layer;button.dataset.anchor=current.id;button.setAttribute('aria-label',current.name+' · synthetische Beispielmessreihe');button.title=current.name+' · Beispielmessreihe';
  button.style.left=`${(point.x+1)*viewport.clientWidth/2}px`;button.style.top=`${(1-point.y)*viewport.clientHeight/2}px`;
 },dispose(){button.remove();}};
}

/** Choose an actual vertex on the front of an existing surface. */
export function surfaceExampleAnchor(THREE,root,layer,name){
 let mesh;root.traverse(o=>{if(o.isMesh&&o.geometry?.attributes?.position&&(!mesh||o.geometry.attributes.position.count>mesh.geometry.attributes.position.count))mesh=o;});
 if(!mesh)return null;const geometry=mesh.geometry;geometry.computeBoundingBox();const b=geometry.boundingBox,p=geometry.attributes.position;
 const tx=(b.min.x+b.max.x)/2,ty=b.min.y+(b.max.y-b.min.y)*.58,tz=b.max.z;let best=0,score=Infinity;
 for(let i=0;i<p.count;i++){const dx=p.getX(i)-tx,dy=p.getY(i)-ty,dz=p.getZ(i)-tz,d=dx*dx+dy*dy+dz*dz;if(d<score){score=d;best=i;}}
 return {object:mesh,layer,id:'surface-'+layer,name,point(out){out.set(p.getX(best),p.getY(best),p.getZ(best));mesh.updateWorldMatrix(true,false);return mesh.localToWorld(out);}};
}
