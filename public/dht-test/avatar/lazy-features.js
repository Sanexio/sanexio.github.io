// Only release metadata is read at startup; no feature code or data until invoked.
import {enabled} from './local-source.js';
export async function mountLazyFeatures(){
 const features=[{row:2,id:'source-open',label:'Quellfassungen öffnen',file:'./source-choice.js',mount:'mountSourceChoice',section:'source-choice'},
 {row:8,id:'micro-open',label:'Gewebe, Zelle und Molekül öffnen',file:'./micro-reference.js',mount:'mountMicroReferences',section:'micro-references'},
 {row:9,id:'body-open',label:'Illustrative Außenhülle öffnen',file:'./body-prototype.js',mount:'mountBodyPrototype',section:'body-prototype'}];
 const host=document.createElement('div');host.id='optional-functions';host.className='actions';(document.querySelector('.app-content')||document.querySelector('.app')).append(host);
 const flags=await Promise.all(features.map(f=>enabled(f.row)));
 for(const [index,f] of features.entries()){
  if(!flags[index])continue;
  const button=document.createElement('button');button.id=f.id;button.type='button';button.className='secondary';button.textContent=f.label;host.append(button);
  let pending;
  f.open=async()=>{
   if(!pending){button.setAttribute('aria-busy','true');pending=import(f.file).then(m=>m[f.mount]()).then(()=>{button.setAttribute('aria-expanded','true');}).catch(e=>{pending=null;button.textContent=f.label+' — erneut versuchen';button.title=e.message;throw e;}).finally(()=>button.removeAttribute('aria-busy'));}
   await pending;document.getElementById(f.section)?.scrollIntoView({block:'start'});
  };
  button.addEventListener('click',()=>f.open().catch(()=>{}));
 }
 const micro=features.find(f=>f.row===8);
 function wire(){if(!micro.open)return;for(const [name,id]of [['gewebe','tissue'],['zelle','cell'],['molekül','molecule']]){const b=document.getElementById('avatar-'+name);if(!b||b.dataset.lazyBound)continue;b.dataset.lazyBound='true';b.disabled=false;b.textContent=name[0].toUpperCase()+name.slice(1)+' · Referenz';b.addEventListener('click',async()=>{try{await micro.open();const s=document.getElementById('micro-choice');s.value=id;s.dispatchEvent(new Event('change',{bubbles:true}));}catch{}});}}
 const observer=new MutationObserver(wire);observer.observe(document.getElementById('avatar-stage').parentElement,{subtree:true,childList:true});wire();window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
}
