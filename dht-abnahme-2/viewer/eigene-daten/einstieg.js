/** Small toolbar entry. The workspace, validator, styles and examples load on demand. */
import {isLocalContext} from '../eigene-daten/kontext.js';
export function mountMessreihen(options) {
  const publicExampleOnly=!isLocalContext(location),tabs=document.querySelector('.explore-tabs'),pain=document.getElementById('pain-tab'),tab=document.createElement('button');
  tab.type='button';tab.id='eigene-daten-tab';tab.setAttribute('role','tab');tab.setAttribute('aria-selected','false');tab.setAttribute('aria-controls','hd-workspace');tab.textContent='Messwerte ';
  const badge=()=>{const tag=document.createElement('span');tag.className='hd-example-tag';tag.textContent='Beispiel';tag.style.cssText='font-size:.7em;margin-left:4px;padding:3px 6px;border-radius:5px;background:#e4eeed;color:#244f51';return tag;};
  tab.append(badge());tabs.append(tab);if(publicExampleOnly){pain.append(badge());pain.setAttribute('aria-controls','hd-workspace');}
  const workspace=document.createElement('section');workspace.id='hd-workspace';workspace.hidden=true;document.querySelector('.app-content').prepend(workspace);
  const failure=document.createElement('p');failure.id='messreihen-ladefehler';failure.hidden=true;failure.setAttribute('role','alert');
  const message=document.createElement('span'),retry=document.createElement('button');retry.type='button';retry.textContent='Messwerte erneut laden';workspace.before(failure);
  let api,pending,generation=0,lastRequest;
  const busyRequests=new WeakMap();
  retry.addEventListener('click',()=>{
    if(!api&&!pending){
      // Browsers retain failed module imports for the lifetime of a document.
      const target=new URL(location.href);target.searchParams.set('modus','daten');target.searchParams.set('ansicht',lastRequest[0]);
      if(lastRequest[2])target.searchParams.set('organ',lastRequest[2]);else target.searchParams.delete('organ');
      location.replace(target.href);return;
    }
    open(...lastRequest);
  });
  async function open(view='organe',selectedTab=tab,organ){
    view=['organe','verlauf','schmerzorte'].includes(view)?view:'organe';
    lastRequest=[view,selectedTab,organ];failure.hidden=true;
    const current=++generation;busyRequests.set(selectedTab,current);selectedTab.setAttribute('aria-busy','true');
    try {
      performance.mark('hd-open');pending ||= import('./ansicht.js').catch(e=>{pending=null;throw e;});
      const module=await pending;api ||= module.mountEigeneDaten({...options,tab});
      if(current===generation)await api.oeffnen(()=>current===generation,view,organ);
      if(current===generation)for(const b of tabs.querySelectorAll('[role=tab]'))b.setAttribute('aria-selected',String(b===selectedTab));
    }catch{if(current===generation){message.textContent='Die Messwerte konnten nicht geladen werden.';failure.replaceChildren(message,' ',retry);failure.hidden=false;}}
    // A stale request must not clear the busy state of its successor.
    finally{if(busyRequests.get(selectedTab)===current){selectedTab.removeAttribute('aria-busy');busyRequests.delete(selectedTab);}}
  }
  function afterTextReady(action){if(document.documentElement.dataset.ready==='true'){action();return;}const current=++generation;const ready=new MutationObserver(()=>{if(document.documentElement.dataset.ready==='true'){ready.disconnect();if(current===generation)action();}});ready.observe(document.documentElement,{attributes:true,attributeFilter:['data-ready']});}
  tab.addEventListener('click',()=>open());
  for(const b of tabs.querySelectorAll('button'))if(b!==tab)b.addEventListener('click',()=>{generation++;failure.hidden=true;tab.removeAttribute('aria-busy');tab.setAttribute('aria-selected','false');});
  tabs.addEventListener('keydown',e=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
    e.preventDefault();e.stopImmediatePropagation();const buttons=[...tabs.querySelectorAll('[role=tab]')],i=buttons.indexOf(document.activeElement);
    const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
    buttons[next].click();buttons[next].focus();
  },true);
  const query=new URLSearchParams(location.search);
  if(query.get('modus')==='daten')afterTextReady(()=>open(query.get('ansicht')||'organe',tab,query.get('organ')));
  return {publicExampleOnly,oeffnen:(view,organ)=>open(view,tab,organ),schmerzBeispiel:()=>afterTextReady(()=>open('schmerzorte',pain)),organGewaehlt:id=>api?.organGewaehlt(id),avatarBereit:()=>api?.avatarBereit()};
}

// Preserve the established entry for local integrations.
export const mountEigeneDaten=mountMessreihen;
