/** Dashboard cards use existing controls and synthetic fixture; no patient input is read. */
const app=document.querySelector('.app'), content=app.querySelector('.app-content');
const root=document.createElement('details'); root.id='dht-panels'; root.open=matchMedia('(min-width: 780px) and (min-height: 620px)').matches;
root.innerHTML=`<summary>Dashboard entdecken</summary><div class="dht-panel-grid">
<section class="dht-card"><h2>Was sehe ich gerade?</h2><strong id="panel-current">Übersicht · Ganzer Körper</strong><p id="panel-explanation">Erklärung folgt.</p></section>
<section class="dht-card"><h2>Die 6 Ebenen</h2><div id="panel-levels"></div></section>
<section class="dht-card"><h2>Messwerte</h2><p>Nur synthetische Beispieldaten.</p><div id="panel-measurements">Organ auswählen.</div><button type="button" data-panel-action="measurements">Messwerte öffnen</button></section>
<section class="dht-card"><h2>Schnellstart</h2><div class="panel-actions"><button type="button" data-panel-action="pain">Wo tut es weh?</button><button type="button" data-panel-action="overview">Zur Übersicht</button><button type="button" data-panel-action="levels">Ebene wechseln</button></div></section></div>`;
content.prepend(root);
const levels=root.querySelector('#panel-levels'), current=root.querySelector('#panel-current'), explanation=root.querySelector('#panel-explanation'), measurements=root.querySelector('#panel-measurements');
let texts={ebenen:[],was_sehe_ich:[],tour:[],wusstest_du:[],hinweise:[]};
fetch('./dashboard-texte.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{texts=data;renderLevels();sync();}).catch(()=>{});
function renderLevels(){
 levels.replaceChildren();
 for(const entry of texts.ebenen){const row=document.createElement('div');row.className='panel-level';const button=document.createElement('button');button.type='button';button.textContent=entry.name;button.dataset.panelLevel=entry.id;const description=document.createElement('small');description.textContent=entry.kurz;row.append(button,description);levels.append(row);}
}
let fixture=[], selected='';
fetch('./eigene-daten/vertrag/beispielperson-v1.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{if(data.synthetisch===true){fixture=data.datensaetze;renderMeasurements();}}).catch(()=>{measurements.textContent='Beispieldaten nicht verfügbar.';});
function renderMeasurements(){
 measurements.replaceChildren();if(!selected){measurements.textContent='Organ auswählen.';return;}
 const records=fixture.filter(d=>d.art==='messwert'&&d.organe?.includes(selected)&&typeof d.wert==='number');
 if(!records.length){measurements.textContent='Für diese Auswahl liegen keine Beispielwerte vor.';return;}
 const series=records.filter(d=>d.loinc?.code===records[0].loinc?.code).sort((a,b)=>b.zeit.tageVorHeute-a.zeit.tageVorHeute), last=series.at(-1);
 const label=document.createElement('strong');label.textContent=`${last.bezeichnung}: ${last.wert.toLocaleString('de-DE')} ${last.einheit}`;
 const chart=document.createElement('div');chart.className='panel-chart';chart.setAttribute('role','img');chart.setAttribute('aria-label','Synthetischer Beispielverlauf: '+series.map(d=>d.wert.toLocaleString('de-DE')).join(', ')+' '+last.einheit);
 const min=Math.min(...series.map(d=>d.wert)), span=Math.max(...series.map(d=>d.wert))-min||1;
 for(const d of series){const bar=document.createElement('span');bar.style.height=(25+75*(d.wert-min)/span)+'%';chart.append(bar);}measurements.append(label,chart);
}
function sync(){
 const host=app.querySelector('#avatar-stage'), selection=host?.dataset.selected||'';if(selection!==selected){selected=selection;renderMeasurements();}
 const label=host?.querySelector('#dashboard-scale')?.textContent;
 if(label&&current.textContent!==label)current.textContent=label;
 const source=host?.querySelector('#avatar-lexikon')?.dataset.source||'';
 const organ=texts.was_sehe_ich.find(item=>source.endsWith('/'+item.id+'.md'));
 const layer=host?.querySelector('.layer-bar button[aria-pressed="true"]')?.dataset.layer;
 const text=organ?.text||texts.ebenen.find(item=>item.id===layer)?.kurz||texts.tour.find(item=>item.id==='start')?.text;
 if(text&&explanation.textContent!==text)explanation.textContent=text;
 for(const b of levels.querySelectorAll('button')){const target=host?.querySelector(`.layer-bar [data-layer="${b.dataset.panelLevel}"]`);b.disabled=!target||target.disabled;b.setAttribute('aria-pressed',String(target?.getAttribute('aria-pressed')==='true'));}
}
levels.addEventListener('click',e=>{const b=e.target.closest('[data-panel-level]');if(b)app.querySelector(`.layer-bar [data-layer="${b.dataset.panelLevel}"]`)?.click();});
root.addEventListener('click',e=>{const action=e.target.closest('[data-panel-action]')?.dataset.panelAction;if(action==='pain'){root.open=false;document.querySelector('#pain-tab')?.click();document.querySelector('#dashboard-anamnese')?.scrollIntoView({block:'nearest'});}if(action==='overview'){document.querySelector('#explore-tab')?.click();document.querySelector('#whole-body')?.click();}if(action==='levels'){const target=document.querySelector('.layer-bar');target?.scrollIntoView({block:'nearest'});target?.querySelector('button')?.focus({preventScroll:true});}if(action==='measurements'){root.open=false;document.querySelector('#eigene-daten-tab')?.click();}});
app.addEventListener('avatar-context',()=>queueMicrotask(sync));app.addEventListener('avatar-layer',()=>queueMicrotask(sync));
const observer=new MutationObserver(sync);observer.observe(app.querySelector('#avatar-stage'),{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['data-selected','data-level','data-source','hidden','aria-current','disabled']});sync();
