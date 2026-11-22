import {zaehlform} from '../eigene-daten/zaehlform.js';
import {istLokalesPaket} from '../eigene-daten/kontext.js';
import {absolut,relativ,zahl,abweichung,reihen,datum,verlaufsText,bereichText} from './projektion.js';
import {pruefen} from '../eigene-daten/vertrag/pruefen.js';
const base=new URL('../eigene-daten/vertrag/',import.meta.url);
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const button=(text,fn,cls='')=>{const b=el('button',cls,text);b.type='button';b.addEventListener('click',fn);return b;};
function spark(series,big=false) {
  const values=series.werte.filter(d=>typeof d.wert==='number'),svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  const available=document.querySelector('.hd-panel-content')?.clientWidth-40;const w=big?Math.min(620,Math.max(280,available||innerWidth-60)):300,h=big?180:64,p=big?32:7;svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.setAttribute('role','img');svg.setAttribute('aria-label',`Messverlauf ${series.werte[0].bezeichnung}, ${zaehlform(values.length,'Messung','Messungen')}; Werte auch in der Tabelle`);
  if(!values.length)return svg;
  const scale=values.flatMap(d=>[d.wert,d.vergleich?.unten,d.vergleich?.oben].filter(Number.isFinite));const min=Math.min(...scale),max=Math.max(...scale),range=max-min||1;
  const first=datum(values[0].zeit).getTime(),last=datum(values.at(-1).zeit).getTime();
  const points=values.map(d=>[p+(datum(d.zeit)-first)/(last-first||1)*(w-p*2),h-p-(d.wert-min)/range*(h-p*2)]);
  const node=(name,attrs)=>{const n=document.createElementNS(svg.namespaceURI,name);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);svg.append(n);return n;};
  if(big) for(let i=0;i<3;i++){const y=p+i*(h-p*2)/2;node('line',{x1:p,y1:y,x2:w-p,y2:y,stroke:'#d5dfe0'});node('text',{x:2,y:y+4,fill:'#41565b','font-size':12}).textContent=zahl(max-i*(max-min)/2);}
  for(let i=0;i<values.length;i++){const d=values[i],c=d.vergleich;if(c&&Number.isFinite(c.unten)&&Number.isFinite(c.oben)){const x=points[i][0],left=i?((points[i-1][0]+x)/2):p,right=i+1<points.length?((points[i+1][0]+x)/2):w-p;const y=n=>Math.max(p,Math.min(h-p,h-p-(n-min)/range*(h-p*2)));node('rect',{x:left,y:y(c.oben),width:Math.max(1,right-left),height:Math.max(1,y(c.unten)-y(c.oben)),fill:'#b3ccca',opacity:.35});}}
  node('polyline',{points:points.map(p=>p.join(',')).join(' '),fill:'none',stroke:'#317a7b','stroke-width':big?2.5:2});
  points.forEach(([x,y],i)=>{const c=node('circle',{cx:x,cy:y,r:big?4:2.5,fill:'#315e68'}),t=document.createElementNS(svg.namespaceURI,'title');t.textContent=`${absolut(values[i].zeit)}: ${zahl(values[i].wert)} ${values[i].einheit}`;c.append(t);});
  return svg;
}
function vergleich(d) {
  const wrap=el('div','hd-comparison'),c=d.vergleich;
  const range=bereichText(d);
  wrap.append(el('p','hd-range',`Vergleich: ${range}`));
  if(Number.isFinite(c?.unten)&&Number.isFinite(c?.oben)&&typeof d.wert==='number'){
    const lo=c.unten,hi=c.oben,span=Math.max(hi-lo,Math.abs(hi)*.1,1),min=Math.min(lo,d.wert)-span*.18,max=Math.max(hi,d.wert)+span*.18;
    const bar=el('div','hd-bar');bar.setAttribute('aria-hidden','true');
    const band=el('span','hd-band');band.style.left=`${(lo-min)/(max-min)*100}%`;band.style.width=`${(hi-lo)/(max-min)*100}%`;
    const dot=el('span','hd-dot');dot.style.left=`${(d.wert-min)/(max-min)*100}%`;bar.append(band,dot);wrap.append(bar);
  }
  wrap.append(el('p','hd-delta',abweichung(d)));if(c)wrap.append(el('p','hd-source',`Bereich aus: ${c.herkunft} · Messdatum ${absolut(d.zeit)}`));return wrap;
}
function table(series) {
  const wrap=el('div','hd-table-wrap'),t=el('table');t.append(el('caption','',`${series.werte[0].bezeichnung} · dokumentierte Messungen`));
  const head=el('thead'),tr=el('tr');for(const name of ['Messdatum','Wert','Einheit','Quelle']){const th=el('th','',name);th.scope='col';tr.append(th);}head.append(tr);t.append(head);
  const body=el('tbody');for(const d of series.werte){const row=el('tr');for(const v of [absolut(d.zeit),typeof d.wert==='number'?zahl(d.wert):d.text,d.einheit,d.quelle.bezeichnung])row.append(el('td','',v));body.append(row);}t.append(body);wrap.append(t);return wrap;
}
export function mountEigeneDaten({avatar,geschlecht,katalog,tab}) {
  const app=document.querySelector('.app'),tabs=document.querySelector('.explore-tabs');

  let stylesPromise;
  function ensureStyles(){return stylesPromise ||= new Promise((resolve,reject)=>{const css=el('link');css.rel='stylesheet';css.href=new URL('./styles.css',import.meta.url).href;css.addEventListener('load',resolve,{once:true});css.addEventListener('error',()=>{stylesPromise=null;css.remove();reject(Error('Die Beispielansicht konnte nicht geladen werden.'));},{once:true});document.head.append(css);});}
  const banner=el('p','hd-banner','Beispieldaten einer erfundenen Person. Eigene Werte erfassen Sie in der lokalen Fassung – sie verlassen Ihr Gerät nicht.');banner.id='hd-banner';banner.hidden=true;document.querySelector('.notice-rail').append(banner);
  const workspace=document.getElementById('hd-workspace')||el('section');workspace.className='hd-workspace';workspace.id='hd-workspace';workspace.hidden=true;workspace.setAttribute('aria-label','Eigene Daten · Beispiel');
  const intro=el('div','hd-intro');intro.append(el('span','hd-eyebrow','IHR GLAS-ZWILLING'),el('h1','','Messwerte im Überblick'),el('p','','Türkis bedeutet: Daten vorhanden. Wählen Sie einen Punkt oder ein Organ in der Liste.'));
  const views=el('div','hd-view-switch');views.setAttribute('role','group');views.setAttribute('aria-label','Datenansicht');
  const overview=button('Organe',()=>showView('organe')),history=button('Verlauf',()=>showView('verlauf')),pain=button('Schmerzorte',()=>showView('schmerzorte'));views.append(overview,history,pain);intro.append(views);
  const list=el('nav','hd-organ-list');list.setAttribute('aria-label','Organliste');
  const panel=el('aside','hd-organ-panel');panel.id='hd-organ-panel';panel.setAttribute('aria-label','Organfeld');panel.hidden=true;
  const grip=button('Organfeld vergrößern',()=>{panel.classList.toggle('hd-expanded');grip.setAttribute('aria-expanded',String(panel.classList.contains('hd-expanded')));},'hd-grip');grip.setAttribute('aria-expanded','false');
  let returnTarget;
  function closePanel(){
    const previous=selected;
    selected=null;panel.hidden=true;
    list.querySelector('[aria-current=true]')?.removeAttribute('aria-current');
    syncMarkers();
    const target=returnTarget?.isConnected&&returnTarget.checkVisibility()?returnTarget:list.querySelector(`[data-organ="${CSS.escape(previous||'')}"]`);
    target?.focus();
  }
  const panelHead=el('div','hd-panel-heading'),close=button('Schließen',closePanel,'hd-close');
  panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();closePanel();}});
  const title=el('h2');panelHead.append(title,close,el('p','hd-panel-example','Beispieldaten einer erfundenen Person.'));const content=el('div','hd-panel-content'),foot=el('p','hd-doctor','Die Einordnung erfolgt ärztlich.');panel.append(grip,panelHead,content,foot);
  const timeline=el('section','hd-timeline');timeline.hidden=true;timeline.setAttribute('aria-label','Verlauf');
  const places=el('section','hd-places');places.hidden=true;places.setAttribute('aria-label','Schmerzorte · Selbstauskunft');
  const welcome=el('aside','hd-welcome');
  const first=button('Messwerte öffnen',()=>{
    const id=Object.keys(counts)[0]||'weitere';
    select(id,false,first);
  },'hd-first');
  welcome.append(el('h2','','Messwerte lesen'),el('p','','Öffnen Sie eine Messreihe, um Wert, Bezugsbereich und frühere Messungen zu sehen.'),first,el('p','hd-doctor','Die Einordnung erfolgt ärztlich.'));
  workspace.append(intro,list,welcome,panel,timeline,places);document.querySelector('.app-content').prepend(workspace);
  let loading,groups=[],data=[],organs=[],counts={},selected=null,view='organe',active=false,exampleData=[],personal=false,period='alle';
  const names=new Map();
  function setPressed(){for(const [b,v]of [[overview,'organe'],[history,'verlauf'],[pain,'schmerzorte']])b.setAttribute('aria-pressed',String(view===v));}
  function syncMarkers(){avatar()?.setDataMarkers?.(active&&view==='organe'?counts:null,selected);}
  async function load(){
    if(loading)return loading;
    loading=(async()=>{
      const read=async file=>{const r=await fetch(new URL(file,base));if(!r.ok)throw Error('Beispieldaten nicht verfügbar');return r.json();};
      const [fixture,mapping,schema]=await Promise.all([read('beispielperson-v1.json'),read('loinc-organ-v1.json'),read('datensatz-v1.schema.json')]);
      data=fixture.datensaetze;exampleData=structuredClone(data);for(const d of data){const errors=pruefen(d,schema,mapping);if(errors.length)throw Error('Beispielvertrag konnte nicht bestätigt werden.');}
      loadedMapping=mapping;groups=reihen(data,mapping);organs=mapping.anatomie;for(const e of organs)names.set(e.id,e.bezeichnung);
      for(const group of groups)for(const id of group.organe)counts[id]=(counts[id]||0)+1;
      renderList();renderPlaces();renderTimeline();workspace.dataset.ready='true';
    })().catch(e=>{loading=null;workspace.append(el('p','hd-error',e.message));throw e;});return loading;
  }
  function renderList(){
    const toolbar=list.querySelector('.anatomie-toolbar');list.replaceChildren();if(toolbar)list.append(toolbar);const label=el('h2','','Organe & Messreihen');list.append(label);
    const ids=[...Object.keys(counts),'weitere','org1:organ:lung-left'];
    for(const id of ids){const name=id==='weitere'?'Weitere Messwerte':names.get(id),count=id==='weitere'?groups.filter(g=>!g.organe.length).length:counts[id]||0;
      const b=button('',()=>select(id,false,b));b.addEventListener('pointerenter',()=>avatar()?.setDataMarkers?.(counts,id));b.addEventListener('pointerleave',syncMarkers);b.addEventListener('focus',()=>avatar()?.setDataMarkers?.(counts,id));b.addEventListener('blur',syncMarkers);b.dataset.organ=id;b.append(el('span','',name),el('span','hd-count',String(count)));b.setAttribute('aria-label',`${name}, ${zaehlform(count,'Messreihe','Messreihen')}`);list.append(b);}
    welcome.hidden=!groups.length;first.textContent=personal?'Meine Messwerte öffnen':'Beispiel ansehen';
    list.append(el('p','hd-list-note',`${zaehlform(groups.length,'Messreihe','Messreihen')}${personal?'':' · etwa zwei Jahre'}`));
  }
  async function select(id,fromBody=false,trigger){
    if(!active)return;if(trigger)returnTarget=trigger;selected=id;view='organe';showView('organe');title.textContent=id==='weitere'?'Weitere Messwerte':names.get(id)||'Organ';content.replaceChildren();
    updateAvailability();
    const selectedGroups=groups.filter(g=>id==='weitere'?!g.organe.length:g.organe.includes(id));
    if(!selectedGroups.length){
      content.append(el('p','hd-empty',personal?'Für dieses Organ sind keine Messwerte gespeichert.':'Für dieses Organ enthält das Beispiel keine Messwerte.'));
      const action=personal?button('Daten importieren',()=>{closePanel();document.querySelector('#hd-import')?.click();},'hd-empty-action'):button('Zur Organliste',()=>{returnTarget=list.querySelector(`[data-organ="${CSS.escape(id)}"]`);closePanel();},'hd-empty-action');
      content.append(action);
    }
    if(id==='weitere'&&!personal)content.append(el('p','hd-offen-hinweis','Messwerte ohne ärztlich bestätigten Organbezug.'));
    for(const group of selectedGroups)content.append(card(group));
    panel.hidden=false;for(const b of list.querySelectorAll('[data-organ]'))b.setAttribute('aria-current',String(b.dataset.organ===id));
    syncMarkers();
    if(!fromBody&&counts[id]){
      const previousView=avatar();
      try {await previousView?.selectDataOrgan?.(id);}
      catch(error){
        if(error.name==='AbortError'&&previousView!==avatar())return;
        throw error;
      }
      if(previousView!==avatar())return;
    }
    syncMarkers();
    title.tabIndex=-1;if(selected===id&&!panel.hidden)title.focus({preventScroll:true});
  }
  function updateAvailability(){
    const female=geschlecht()==='weiblich';
    const status=id=>female?avatar()?.dataOrganStatus?.(id):null;
    for(const row of list.querySelectorAll('[data-organ]')){
      const id=row.dataset.organ,missing=counts[id]&&['missing','error'].includes(status(id));
      let note=row.querySelector('.hd-only-list');
      if(missing&&!note){
        note=el('small','hd-only-list','Nur in der Liste');row.firstChild.append(note);
        row.setAttribute('aria-label',row.getAttribute('aria-label')+', nur in der Liste');
      }else if(!missing&&note){note.remove();row.setAttribute('aria-label',row.getAttribute('aria-label').replace(', nur in der Liste',''));}
    }
    const note=content.querySelector(':scope > .hd-missing');
    const state=selected&&counts[selected]&&status(selected);
    if(state==='error'||state==='missing'){
      const hint=note||el('p','hd-missing');
      hint.textContent=state==='error'?'Die Organdarstellung konnte nicht geladen werden. Hier sehen Sie die Messwerte.':'Dieses Organ ist in der weiblichen Ansicht noch nicht enthalten. Hier sehen Sie seine Messwerte.';
      if(!note)content.prepend(hint);
    }else note?.remove();
  }
  app.addEventListener('avatar-layer',()=>{if(active)updateAvailability();});
  function card(group){
    const original=group;group=filtered(group);const d=group.werte.at(-1)||original.werte.at(-1),c=el('article','hd-card');c.dataset.series=d.loinc.code;c.append(el('h3','',d.bezeichnung));
    const value=el('p','hd-value',typeof d.wert==='number'?zahl(d.wert):d.text);value.append(el('span','hd-unit',' '+d.einheit));c.append(value,el('p','hd-date',`${relativ(d.zeit)} · ${absolut(d.zeit)}`),el('p','hd-source',`${personal?'aus:':'Quelle:'} ${d.quelle.bezeichnung}`),vergleich(d));
    if(group.werte.length)c.setAttribute('aria-label',`${d.bezeichnung}, ${value.textContent}, Vergleich: ${bereichText(d)}, ${abweichung(d)}, Messdatum ${absolut(d.zeit)}`);
    const periods=el('div','hd-periods');for(const [key,label]of [['alle','Alle'],['jahre','2 Jahre'],['drei','letzte 3 Messungen']]){const b=button(label,()=>{
      const openKeys=new Set([...content.querySelectorAll('.hd-series[open]')].map(detail=>detail.dataset.key));
      period=key;
      const selectedGroups=groups.filter(g=>selected==='weitere'?!g.organe.length:g.organe.includes(selected));
      const otherCards=[...content.querySelectorAll('.hd-card')];
      for(const [i,other] of otherCards.entries()){
        const source=selectedGroups[i];
        const updated=card(source);other.replaceWith(updated);
        const detail=updated.querySelector('.hd-series');
        if(detail)detail.open=openKeys.has(detail.dataset.key);
        if(other===c){
          updated.querySelector('.hd-periods [aria-pressed=true]').focus({preventScroll:true});
        }
      }
    });b.setAttribute('aria-pressed',String(period===key));periods.append(b);}c.append(periods);if(!group.werte.length){for(const n of c.querySelectorAll('.hd-value,.hd-date,.hd-source,.hd-comparison'))n.remove();c.append(el('p','hd-empty','Keine Messung im gewählten Zeitraum'));return c;}
    const mini=el('div','hd-spark');mini.append(spark(group));const trend=verlaufsText(group.werte);if(trend)mini.append(el('p','hd-trend',trend));c.append(mini);
    const detail=el('details','hd-series'),summary=el('summary','','Verlauf & Tabelle');detail.dataset.key=group.key;detail.append(summary);
    detail.addEventListener('toggle',()=>{if(detail.open&&!detail.dataset.built){detail.dataset.built='true';const large=el('div','hd-large-chart');large.append(spark(group,true),el('p','hd-axis',`${absolut(group.werte[0].zeit)} — ${absolut(d.zeit)} · ${d.einheit}`));detail.append(large,table(group));content.scrollTop=0;}if(detail.open)resizeCharts();});c.append(detail);return c;
  }
  function filtered(group){let werte=group.werte;if(period==='drei')werte=werte.slice(-3);if(period==='jahre'){const cut=new Date();cut.setFullYear(cut.getFullYear()-2);werte=werte.filter(d=>datum(d.zeit)>=cut);}return {...group,werte};}
  function renderTimeline(filter='alle'){
    timeline.replaceChildren(el('h2','','Verlauf'));
    const label=el('label','','Nach Organ filtern '),filterSelect=el('select');filterSelect.id='hd-filter';
    for(const id of ['alle',...Object.keys(counts),'weitere']){const o=el('option','',id==='alle'?'Alle Einträge':id==='weitere'?'Weitere Messwerte':names.get(id));o.value=id;filterSelect.append(o);}filterSelect.value=filter;label.append(filterSelect);timeline.append(label);filterSelect.addEventListener('change',()=>{renderTimeline(filterSelect.value);timeline.querySelector('#hd-filter').focus({preventScroll:true});});
    filterSelect.addEventListener('keydown',event=>{if(event.altKey||event.ctrlKey||event.metaKey||!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;event.preventDefault();const last=filterSelect.options.length-1;filterSelect.selectedIndex=event.key==='Home'?0:event.key==='End'?last:Math.max(0,Math.min(last,filterSelect.selectedIndex+(event.key==='ArrowDown'?1:-1)));filterSelect.dispatchEvent(new Event('change',{bubbles:true}));});
    timeline.append(el('p','hd-timeline-doctor','Die Einordnung erfolgt ärztlich.'));
    const rows=data.filter(d=>d.bestaetigt&&(filter==='alle'||(d.art==='messwert'&&(filter==='weitere'?!d.organe.length:d.organe.includes(filter))))).sort((a,b)=>datum(b.zeit)-datum(a.zeit));
    const days=new Map();for(const d of rows){const key=absolut(d.zeit);if(!days.has(key))days.set(key,[]);days.get(key).push(d);}
    for(const [day,values]of days){const section=el('section','hd-day');section.append(el('h3','',`${day} · ${relativ(values[0].zeit)}`));for(const d of values){const row=el('div','hd-history-row');row.append(el('span','',d.bezeichnung),el('strong','',d.art==='schmerzort'?d.text:`${typeof d.wert==='number'?zahl(d.wert):d.text} ${d.einheit}`),el('small','',d.quelle.bezeichnung));section.append(row);}timeline.append(section);}
  }
  function renderPlaces(){
    places.replaceChildren(el('h2','','Wo tut es weh?'),el('p','','Dokumentierte Schmerzorte · Selbstauskunft mit Datum.'));
    const ul=el('ul','orteliste');for(const d of data.filter(d=>d.art==='schmerzort')){
      const region=katalog()?.regionen.find(r=>r.strukturen.some(s=>s.id===d.ort.id));const structure=region?.strukturen.find(s=>s.id===d.ort.id);
      const li=el('li');li.append(el('strong','',`${region?.label||''} · ${structure?.label||d.bezeichnung} · ${d.ort.seite}`),el('p','',`${d.text} · ${relativ(d.zeit)} · ${absolut(d.zeit)}`));ul.append(li);
    }places.append(ul,el('p','hd-doctor','Die Einordnung erfolgt ärztlich.'));
  }
  function showView(next){view=next;workspace.dataset.view=next;setPressed();list.hidden=next!=='organe';timeline.hidden=next!=='verlauf';places.hidden=next!=='schmerzorte';panel.hidden=next!=='organe'||!selected;syncMarkers();resizeCharts();}
  async function activate(stillWanted=()=>true,requestedView){
    await ensureStyles();if(!stillWanted())return;if(requestedView)view=requestedView;active=true;app.dataset.mode='data';workspace.hidden=false;banner.hidden=false;
    for(const b of tabs.querySelectorAll('[role=tab]'))b.setAttribute('aria-selected',String(b===tab));
    await load();if(!stillWanted())return;const toolbar=document.querySelector('.anatomie-toolbar');if(toolbar)list.prepend(toolbar);showView(view);syncMarkers();updateAvailability();performance.mark('hd-ready');performance.measure('hd-startlast','hd-open','hd-ready');if(await istLokalesPaket()){localReady ||= import('../eigene-daten/lokal/oberflaeche.js').then(m=>m.mount({workspace,example:()=>replaceData(exampleData,false),personal:ds=>replaceData(ds,true),katalog,ready:()=>active}));await localReady;}
  }
  for(const b of tabs.querySelectorAll('button'))if(b!==tab)b.addEventListener('click',()=>{active=false;workspace.hidden=true;banner.hidden=true;tab.setAttribute('aria-selected','false');avatar()?.setDataMarkers?.(null);});

  let localReady;
  function replaceData(ds,isPersonal){
    data=structuredClone(ds);personal=isPersonal;period='alle';selected=null;returnTarget=null;panel.hidden=true;title.textContent='';content.replaceChildren();counts={};
    groups=reihen(data,loadedMapping);
    for(const g of groups)for(const id of g.organe)counts[id]=(counts[id]||0)+1;
    workspace.dataset.source=personal?'meine':'beispiel';
    banner.textContent=personal?'Meine Daten · Nur auf diesem Gerät · verschlüsselt':'Beispieldaten einer erfundenen Person.';
    panelHead.querySelector('.hd-panel-example').textContent=personal?'Meine Daten · lokal verschlüsselt':'Beispieldaten einer erfundenen Person.';
    renderList();updateAvailability();renderPlaces();renderTimeline();showView('organe');syncMarkers();
  }
  let loadedMapping;
  function resizeCharts(){if(!active||view!=='organe'||panel.hidden)return;for(const detail of content.querySelectorAll('.hd-series[open]')){const group=groups.find(g=>g.key===detail.dataset.key);if(group)detail.querySelector('.hd-large-chart svg')?.replaceWith(spark(filtered(group),true));}}
  window.addEventListener('resize',resizeCharts);
  // Dragging adjusts the sheet only; the same action is available as a button.
  let startY;grip.addEventListener('pointerdown',e=>{startY=e.clientY;grip.setPointerCapture(e.pointerId);});grip.addEventListener('pointerup',e=>{if(startY!==undefined&&Math.abs(e.clientY-startY)>25){panel.classList.toggle('hd-expanded',e.clientY<startY);grip.setAttribute('aria-expanded',String(panel.classList.contains('hd-expanded')));}startY=undefined;});
  return {oeffnen:activate,organGewaehlt(id){if(active&&names.has(id)&&id!==selected)select(id,true,document.querySelector(`[data-data-organ="${CSS.escape(id)}"]`));},avatarBereit(){syncMarkers();if(active)updateAvailability();}};
}
