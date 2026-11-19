/** Small toolbar entry. The workspace, validator, styles and examples load on demand. */
import {isLocalContext} from '../eigene-daten/kontext.js';
export function mountEigeneDaten(options) {
  const publicExampleOnly=!isLocalContext(location),tabs=document.querySelector('.explore-tabs'),pain=document.getElementById('pain-tab'),tab=document.createElement('button');
  tab.type='button';tab.id='eigene-daten-tab';tab.setAttribute('role','tab');tab.setAttribute('aria-selected','false');tab.setAttribute('aria-controls','hd-workspace');tab.textContent='Eigene Daten ';
  const badge=()=>{const tag=document.createElement('span');tag.className='hd-example-tag';tag.textContent='Beispiel';tag.style.cssText='font-size:.7em;margin-left:4px;padding:3px 6px;border-radius:5px;background:#e4eeed;color:#244f51';return tag;};
  tab.append(badge());tabs.append(tab);if(publicExampleOnly){pain.append(badge());pain.setAttribute('aria-controls','hd-workspace');}
  const workspace=document.createElement('section');workspace.id='hd-workspace';workspace.hidden=true;document.querySelector('.app-content').prepend(workspace);
  let api,pending,generation=0;
  async function open(view='organe',selectedTab=tab){
    const current=++generation;selectedTab.setAttribute('aria-busy','true');
    try {
      performance.mark('hd-open');pending ||= import('./ansicht.js').catch(e=>{pending=null;throw e;});
      const module=await pending;api ||= module.mountEigeneDaten({...options,tab});
      if(current===generation)await api.oeffnen(()=>current===generation,view);
      if(current===generation)for(const b of tabs.querySelectorAll('[role=tab]'))b.setAttribute('aria-selected',String(b===selectedTab));
    }catch{selectedTab.title='Beispielansicht konnte nicht geladen werden. Erneut öffnen.';}
    finally{selectedTab.removeAttribute('aria-busy');}
  }
  function afterTextReady(action){if(document.documentElement.dataset.ready==='true'){action();return;}const current=++generation;const ready=new MutationObserver(()=>{if(document.documentElement.dataset.ready==='true'){ready.disconnect();if(current===generation)action();}});ready.observe(document.documentElement,{attributes:true,attributeFilter:['data-ready']});}
  tab.addEventListener('click',()=>open());
  for(const b of tabs.querySelectorAll('button'))if(b!==tab)b.addEventListener('click',()=>{generation++;tab.setAttribute('aria-selected','false');});
  tabs.addEventListener('keydown',e=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
    e.preventDefault();e.stopImmediatePropagation();const buttons=[...tabs.querySelectorAll('[role=tab]')],i=buttons.indexOf(document.activeElement);
    const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
    buttons[next].click();buttons[next].focus();
  },true);
  if(new URLSearchParams(location.search).get('modus')==='daten')afterTextReady(()=>open());
  return {publicExampleOnly,schmerzBeispiel:()=>afterTextReady(()=>open('schmerzorte',pain)),organGewaehlt:id=>api?.organGewaehlt(id),avatarBereit:()=>api?.avatarBereit()};
}
