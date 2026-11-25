import {femaleBindingAllowed} from './female-policy.js';
import {zaehlform} from '../eigene-daten/zaehlform.js';

// Each anchor is a fitted, individually identified part in the female atlas.
// Recheck its identity at runtime before using its own geometry as a locator.
const anchors = [
  ['TA2:3023:M','Leber','female:node:526','TA2:3033'],
  ['TA2:3114:M','Bauchspeicheldrüse','female:node:555','TA2:3119'],
  ['org1:organ:heart','Herz','female:node:677','TA2:4062'],
  ['org1:organ:kidney-left','Niere links','female:node:566','TA2:3361'],
  ['org1:organ:kidney-right','Niere rechts','female:node:597','TA2:3361'],
];

export function femaleDataMarkers({THREE,viewport,objects,camera,onDataOrgan}) {
  const host=document.createElement('div');
  host.className='data-organ-markers';
  viewport.append(host);
  const markers=new Map();
  const present=new Set();
  let picked=null;
  function set(counts,selected){
    picked=selected;
    present.clear();
    for(const [id,name,node,code] of anchors){
      const entry=objects.get(node)?.entry;
      if(!counts?.[id] || !femaleBindingAllowed(entry) || entry.ta2_id!==code){
        markers.get(id)?.remove();markers.delete(id);continue;
      }
      present.add(node);
      let b=markers.get(id);
      if(!b){
        b=document.createElement('button');b.type='button';b.hidden=true;
        b.dataset.dataOrgan=id;b.dataset.anchor=node;b.textContent='•';
        b.addEventListener('click',()=>onDataOrgan(id));markers.set(id,b);host.append(b);
      }
      b.dataset.label=`${name} · ${zaehlform(counts[id],'Messreihe','Messreihen')}`;
      b.setAttribute('aria-label',b.dataset.label+', Daten vorhanden');
      b.setAttribute('aria-pressed',String(id===picked));
    }
  }
  const box=new THREE.Box3(), point=new THREE.Vector3();
  function paint(){
    for(const b of markers.values()){
      const mesh=objects.get(b.dataset.anchor)?.object;
      b.hidden=!mesh?.visible;
      if(b.hidden)continue;
      box.setFromObject(mesh).getCenter(point);b.dataset.world=point.toArray().join(',');point.project(camera);
      b.hidden=Math.abs(point.x)>1||Math.abs(point.y)>1||Math.abs(point.z)>1;
      b.style.left=`${(point.x+1)*viewport.clientWidth/2}px`;
      b.style.top=`${(1-point.y)*viewport.clientHeight/2}px`;
      b.dataset.labelSide=point.x>0?'left':'right';
    }
  }
  function status(id,failed){if(failed&&anchors.some(([organ])=>organ===id))return 'error';const b=markers.get(id);return b&&objects.get(b.dataset.anchor)?.object?.visible?'shown':'missing';}
  return {present,set,paint,status};
}
