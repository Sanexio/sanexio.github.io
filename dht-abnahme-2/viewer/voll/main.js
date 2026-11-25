import {publicFullView} from './lib/public-view.js';
import { idbPut, idbAll, idbClear, STORES, scope, snapshot } from './lib/idb.js';
import { simulateCaffeine } from './lib/pbpk.js';
import { validateG6B, balanceFlow, simulateG6B } from './lib/g6b.js';
import { explainValue } from './lib/narrator.js';
import {enableOfflineCache} from '../offline-cache.js';
let browserOCR = {clear(){}};

const MODS = [
  ['anatomie', '3D-Anatomie'],
  ['dashboard', 'Dashboard'],
  ['labor', 'Labor'],
  ['health-import', 'Health-Import'],
  ['ocr', 'OCR/Text'],
  ['narrator', 'Erklärung'],
  ['ki-manifest', 'KI-Manifest'],
  ['verlauf', 'Verlauf'],
  ['future', 'Future-Self'],
  ['ziele', 'Ziele'],
  ['badges', 'Badges'],
  ['nudges', 'Erinnerungen'],
  ['quick', 'Schnellübersicht'],
  ['graph', 'Graph'],
  ['produkte', 'Angebote'],
  ['physio', 'Physiologie'],
  ['g6b', 'G6B'],
  ['pbpk', 'PBPK'],
  ['simzeit', 'Zeitachse'],
  ['editor', 'Editor'],
  ['compare', 'Vergleich'],
  ['notizen', 'Notizen'],
  ['mandant', 'Zweck'],
  ['export', 'Export'],
];

let activeMod = 'dashboard';
let g6bModel = null;
let simEvents = [];
let lastLab = null;

function $(id) {
  return document.getElementById(id);
}

function showMod(key) {
  activeMod = key;
  if(key==='ocr' && !browserOCR.loading){browserOCR.loading=true;import('./lib/browser-ocr.js').then(m=>m.mountBrowserOCR()).then(api=>{browserOCR=api;browserOCR.loading=true;}).catch(e=>{browserOCR.loading=false;$('panel-ocr').append(document.createTextNode('Bild-OCR nicht verfügbar: '+e.message));});}
  if(key==='future'){const f=$('future-frame');if(!f.src)f.src=f.dataset.src;}
  if (key === 'anatomie') { const frame=$('anatomie-frame'); if (!frame.src) frame.src=frame.dataset.src; }
  document.querySelectorAll('.panel').forEach((p) => {
    p.dataset.active = String(p.dataset.mod === key);
  });
  document.querySelectorAll('#mod-nav button').forEach((b) => {
    b.dataset.active = String(b.dataset.mod === key);
  });
}

function parseLabText(text) {
  const t = text.trim();
  if (t.startsWith('{')) {
    try {
      return JSON.parse(t);
    } catch {
      return { parseError: 'Ungültiges JSON' };
    }
  }
  const lines = t.split(/\n+/).filter(Boolean);
  return lines.map((line) => {
    const m = line.match(/([A-Za-z0-9_]+)\s*[:=]\s*([\d.,]+)\s*(\S*)/);
    return m ? { marker: m[1].toLowerCase(), wert: parseFloat(m[2].replace(',', '.')), einheit: m[3] || '' } : { roh: line };
  });
}

async function refreshDashboard() {
  const labs = await idbAll('labor');
  const last = labs[labs.length - 1];
  const summary = document.createElement('p');
  summary.textContent = last ? `${last.marker}: ${last.wert} ${last.einheit || ''}. Kein Vergleichsbereich angegeben. Die Einordnung erfolgt ärztlich.` : 'Keine eigenen Daten vorhanden. Die Einordnung erfolgt ärztlich.';
  $('dash-ampeln').replaceChildren(summary);
}

let nudgeTimer;
const json = value => JSON.stringify(value,null,2);
const list = (id, values) => $(id).replaceChildren(...values.map(text => {const li=document.createElement('li');li.textContent=text;return li;}));
function number(id) {const raw=$(id).value.trim();const n=Number(raw);if(!raw||!Number.isFinite(n))throw Error('Endliche Zahl erforderlich.');return n;}
async function notes() {list('note-list',(await idbAll('notizen')).map(n=>n.text));}
function resetDrafts() {
  browserOCR.clear();
  for(const field of document.querySelectorAll('.panel input,.panel textarea')) {
    if(field.type==='checkbox')field.checked=field.defaultChecked;
    else field.value=field.type==='file'?'':field.defaultValue;
  }
  $('event-type').selectedIndex=0;
  for(const el of document.querySelectorAll('.panel .out'))el.textContent='';
  for(const id of ['profile-status','narrator-text','nudge-status','export-status','challenge-status'])$(id).textContent='';
  for(const id of ['note-list','badge-list','nudge-list'])$(id).replaceChildren();
  $('dash-ampeln').replaceChildren();
  for(const id of ['anatomie-frame','future-frame']){const frame=$(id);if(frame.hasAttribute('src'))frame.src=frame.dataset.src;}
  $('future-years').dispatchEvent(new Event('input'));
}
async function profile() {
 const p=(await idbAll('profil'))[0];$('profile-alias').value=p?.alias||'';$('consent').checked=p?.consent===true;
 $('profile-status').textContent=p?.consent?`Einstieg abgeschlossen: ${p.alias} · Einwilligung ${p.ts}`:'Einstieg offen: Hinweise lesen und lokale Speicherung bestätigen.';
}
async function challenge() {
 const labs=await idbAll('labor'), goals=await idbAll('ziele');const progress=Number(labs.length>0)+Number(goals.some(g=>g.text.trim()));
 $('challenge-status').textContent=`Herausforderung: ein eigener lokaler Wert und ein Ziel · Fortschritt ${progress}/2`;
 list('badge-list',(await idbAll('badges')).map(b=>b.titel));return progress;
}
async function drawVerlauf() {
 const all=[];
 for(const store of ['labor','vitals','health_import']) for(const row of await idbAll(store)) {
  const rows=store==='health_import'?(Array.isArray(row.data)?row.data:[row.data]):[row];
  for(const r of rows) if(r && typeof r.marker==='string' && Number.isFinite(r.wert) && Number.isFinite(Date.parse(r.ts))) all.push({...r,source:store});
 }
 const groups=new Map();for(const r of all){const key=`${r.source} | ${r.marker} | ${r.einheit||''}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
 const sel=$('series-select'),current=sel.value;sel.replaceChildren(...[...groups.keys()].map(k=>{const o=document.createElement('option');o.value=k;o.textContent=k;return o;}));if(groups.has(current))sel.value=current;
 const pts=(groups.get(sel.value)||[]).sort((a,b)=>Date.parse(a.ts)-Date.parse(b.ts));
 const c=$('verlauf-chart'),ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);
 const baseline=pts.length?pts.reduce((sum,r)=>sum+r.wert,0)/pts.length:null;
 $('verlauf-out').textContent=json({reihe:sel.value||null,basislinie:baseline,punkte:pts,hinweis:'Basislinie = Mittel der gespeicherten Werte derselben Reihe und Einheit. Importierte Vital-/Scorewerte benötigen marker, wert, einheit und ts. Keine Bewertung.'});
 ctx.fillStyle='#9aacbd';ctx.fillText(pts.length?`${sel.value} · Basislinie ${baseline.toFixed(2)}`:'Keine gespeicherten Werte',12,16);
 if(!pts.length)return;
 const lo=Math.min(...pts.map(p=>p.wert),baseline)-1,hi=Math.max(...pts.map(p=>p.wert),baseline)+1;
 const start=Date.parse(pts[0].ts),span=Date.parse(pts.at(-1).ts)-start;
 const y=v=>c.height-20-(v-lo)/(hi-lo)*(c.height-45);
 ctx.strokeStyle='#e8b84a';ctx.beginPath();ctx.moveTo(20,y(baseline));ctx.lineTo(c.width-20,y(baseline));ctx.stroke();ctx.strokeStyle='#2db8a8';ctx.beginPath();
 pts.forEach((p,i)=>{const x=20+(span?(Date.parse(p.ts)-start)/span:0.5)*(c.width-40);i?ctx.lineTo(x,y(p.wert)):ctx.moveTo(x,y(p.wert));});ctx.stroke();
 ctx.fillStyle='#2db8a8';for(const p of pts){const x=20+(span?(Date.parse(p.ts)-start)/span:0.5)*(c.width-40);ctx.beginPath();ctx.arc(x,y(p.wert),3,0,7);ctx.fill();}
}
async function reminders() {
 clearTimeout(nudgeTimer);const rows=await idbAll('erinnerungen'),now=Date.now();
 for(const r of rows)if(r.status==='geplant'&&r.due<=now){r.status='faellig';await idbPut('erinnerungen',r);$('nudge-status').textContent=`In-App: ${r.text} · fällig / nach Wiederaufnahme`;}
 list('nudge-list',rows.map(r=>`${r.text} · ${r.status} · ${new Date(r.due).toLocaleString('de-DE')}`));
 const next=rows.filter(r=>r.status==='geplant').sort((a,b)=>a.due-b.due)[0];
 if(next)nudgeTimer=setTimeout(()=>reminders().catch(console.error),Math.min(Math.max(1,next.due-Date.now()),2147483647));
}
function params() {return {dose_mg:number('pbpk-dose'),hours:12,dt_h:0.25,events:structuredClone(simEvents)};}
function outputSimulation() {const pts=simulateCaffeine(params());$('pbpk-out').textContent='Synthetische Modellmengen, keine Anwendungsempfehlung\n'+pts.map(p=>`t=${p.t_h}h blut=${p.blut_mg.toFixed(4)} leber=${p.leber_mg.toFixed(4)} rest=${p.rest_mg.toFixed(4)}`).join('\n');return pts;}
async function exportLocal(format) {
 const status=$('export-status');
 try {
  const r=await fetch('/__dht/export',{cache:'no-store'});if(!r.ok)throw Error();const config=await r.json();
  const data={schema:'dht-local-state/2',zweck:scope(),stores:await snapshot(),arbeitsstand:{modell:g6bModel,parameter:params(),ereignisse:simEvents},lokale_einstellungen:{zweck:scope()},ts:new Date().toISOString()};
  const result=await fetch('/__dht/export',{method:'POST',headers:{'Content-Type':'application/json','X-DHT-Token':config.token},body:json({directory:$('export-directory').value.trim()||config.directory,format,data})});
  if(!result.ok)throw Error();status.textContent=`Export gespeichert: ${(await result.json()).path}`;
 } catch {status.textContent='Export abgewiesen. Lokalen DHT-Starter verwenden und Ziel / Backup-Ausschluss prüfen.';}
}

async function init() {
  if(publicFullView())return;
  document.querySelector('.shell').hidden=false;document.querySelector('.shell').removeAttribute('inert');
  const nav = $('mod-nav');
  for (const [key, label] of MODS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.mod = key;
    b.textContent = label;
    b.addEventListener('click', () => showMod(key));
    nav.append(b);
  }
  showMod('dashboard');

  const g6bRes = await fetch('./data/g6b-minimal.json', { cache: 'no-store' });
  g6bModel = await g6bRes.json();
  $('model-json').value = JSON.stringify(g6bModel, null, 2);

  $('dash-refresh').addEventListener('click', () => refreshDashboard());
  $('lab-save').addEventListener('click', async () => {
    if (!$('lab-marker').value.trim() || !$('lab-wert').value.trim() || !Number.isFinite(Number($('lab-wert').value))) { $('lab-out').textContent='Abgewiesen: Marker und endlicher Wert erforderlich.'; return; }
    const row = {
      marker: $('lab-marker').value.trim(),
      wert: Number($('lab-wert').value),
      einheit: $('lab-einheit').value.trim(),
      ts: new Date().toISOString(),
    };
    await idbPut('labor', row);
    lastLab = row;
    $('lab-out').textContent = `Gespeichert: ${JSON.stringify(row)}`;
    await refreshDashboard(); await drawVerlauf(); await challenge();
  });
  $('lab-list').addEventListener('click', async () => {
    $('lab-out').textContent = JSON.stringify(await idbAll('labor'), null, 2);
  });

  $('health-import').addEventListener('click', async () => {
    const file = $('health-file').files?.[0];
    if (!file) {
      $('health-out').textContent = 'Bitte JSON-Datei wählen.';
      return;
    }
    const text = await file.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      $('health-out').textContent = 'Ungültiges JSON.';
      return;
    }
    await idbPut('health_import', { data, imported: new Date().toISOString() });
    $('health-out').textContent = `Importiert (${Array.isArray(data) ? data.length : 1} Einträge).`;
  });

  $('ocr-parse').addEventListener('click', () => {
    const out = parseLabText($('ocr-text').value);
    $('ocr-out').textContent = JSON.stringify(out, null, 2);
  });

  $('narrator-run').addEventListener('click', async () => {
    if (!lastLab) {
      const labs = await idbAll('labor');
      lastLab = labs[labs.length - 1];
    }
    const ctx = lastLab ? { marker: lastLab.marker, wert: Number(lastLab.wert) } : { marker: 'ruhepuls', wert: 72 };
    $('narrator-text').textContent = explainValue(ctx);
  });

  $('ki-manifest-check').addEventListener('click', async () => {
    const file = $('ki-manifest-file').files?.[0];
    if (!file) {
      $('ki-manifest-out').textContent = 'Manifest-JSON wählen (nur lokal, kein Upload).';
      return;
    }
    try {
      const man = JSON.parse(await file.text());
      const ok = man.schema && man.model_id;
      $('ki-manifest-out').textContent = ok ? `Metadaten gelesen: ${String(man.model_id)}.\nKeine Modellbindung oder Inferenz.\nEs fehlen: Browserlaufzeit, kompatible Gewichte, Tokenizer und Integritätsprüfung.` : 'Fehlende Felder schema/model_id — keine Modellbindung oder Inferenz.';
    } catch {
      $('ki-manifest-out').textContent = 'Ungültiges Manifest.';
    }
  });

  $('verlauf-draw').addEventListener('click', () => drawVerlauf());
  $('series-select').addEventListener('change',()=>drawVerlauf());
  $('future-years').addEventListener('input', (ev) => {
    const years=Number(ev.target.value); $('future-text').textContent = `Illustration: +${years} Jahre — rein visuell, keine Prognose oder individuelle Morphometrie. Farbton am Atlasavatar verändert sich.`;
    const frame=$('future-frame');frame.style.filter=`sepia(${years/60}) saturate(${1-years/60})`;frame.dataset.years=String(years);
  });
  $('future-years').dispatchEvent(new Event('input'));

  $('ziel-save').addEventListener('click', async () => {
    if(!$('ziel-text').value.trim()){$('ziel-out').textContent='Zieltext erforderlich.';return;}
    await idbPut('ziele', { text: $('ziel-text').value, ts: new Date().toISOString() });
    $('ziel-out').textContent = 'Ziel gespeichert.'; await challenge();
  });
  $('briefing-show').addEventListener('click', async () => {
    const ziele = await idbAll('ziele');
    const labs = await idbAll('labor');
    $('ziel-out').textContent = JSON.stringify({ datum: new Date().toDateString(), ziele: ziele.slice(-3), labor_anzahl: labs.length }, null, 2);
  });

  $('visit-save').addEventListener('click',async()=>{
    const visits=await idbAll('besuche'),previous=visits.at(-1);
    const current={ts:new Date().toISOString(),labor:await idbAll('labor'),vitals:await idbAll('vitals'),ziele:await idbAll('ziele')};
    await idbPut('besuche',current);
    $('ziel-out').textContent=json({aktuell:current,vorher:previous||null,vergleich:previous?{neue_laborwerte:current.labor.length-previous.labor.length,neue_vitalwerte:current.vitals.length-previous.vitals.length,neue_ziele:current.ziele.length-previous.ziele.length,letzter_wert_vorher:previous.labor.at(-1)||null,letzter_wert_jetzt:current.labor.at(-1)||null}:'Erster Besuch gespeichert.'});
  });
  $('badge-earn').addEventListener('click',async()=>{
    const progress=await challenge();
    if(progress===2){await idbPut('badges',{id:'lokaler-start',titel:'Lokaler Start abgeschlossen',ts:new Date().toISOString()});await challenge();$('challenge-status').textContent+=' · abgeschlossen';}
  });
  $('nudge-set').addEventListener('click',async()=>{
    try {const min=number('nudge-min'),text=$('nudge-text').value.trim();if(min<=0||min>1440||!text)throw Error();
      await idbPut('erinnerungen',{text,min,due:Date.now()+min*60000,status:'geplant'});await reminders();$('nudge-status').textContent=`Geplant in ${min} Min. · nach Wiederöffnung wieder aufgenommen; bei geschlossenem Browser keine Zustellung.`;
    }catch{$('nudge-status').textContent='Text und Minuten zwischen 0 und 1440 erforderlich.';}
  });
  $('nudge-cancel').addEventListener('click',async()=>{for(const r of await idbAll('erinnerungen'))if(r.status==='geplant'){r.status='abgebrochen';await idbPut('erinnerungen',r);}await reminders();$('nudge-status').textContent='Geplante Erinnerungen abgebrochen.';});
  $('nudge-notify').addEventListener('click', async () => {
    $('nudge-status').textContent = 'Benachrichtigungen: wird angefragt…';
    if (!('Notification' in window)) {
      $('nudge-status').textContent = 'Notification API nicht verfügbar — nur In-App.';
      return;
    }
    let p = 'default';
    try {
      p = await Notification.requestPermission();
    } catch {
      p = Notification.permission || 'default';
    }
    $('nudge-status').textContent = `Benachrichtigungen: ${p}`;
  });

  $('quick-refresh').addEventListener('click', async () => {
    const labs = await idbAll('labor');
    const ziele = await idbAll('ziele');
    $('quick-out').textContent = JSON.stringify({ labor: labs.slice(-1), ziele: ziele.slice(-1), hinweis: 'Ersatz für watchOS-Widget' }, null, 2);
  });

  $('graph-load').addEventListener('click', async () => {
    const g = await (await fetch('./data/graph-synthetic.json', { cache: 'no-store' })).json();
    const box = $('graph-nodes');
    box.replaceChildren();
    for (const n of g.knoten) {
      const d = document.createElement('span');
      d.className = 'graph-node';
      d.textContent = n.label;
      box.append(d);
    }
    for(const e of g.kanten){const d=document.createElement('p');d.dataset.relation=e.relation;d.textContent=`${e.von} → ${e.nach} · ${e.relation} · synthetische Quelle`;box.append(d);}
    const hint=document.createElement('p');hint.textContent='Synthetischer Demonstrationsgraph; keine freigegebene Marker→Organ-Bewertung oder Geometriebindung.';box.append(hint);
  });

  $('produkt-load').addEventListener('click', async () => {
    const k = await (await fetch('./data/produkte-synthetic.json', { cache: 'no-store' })).json();
    const ul = $('produkt-list');
    ul.replaceChildren(...k.angebote.map((a) => {
      const li = document.createElement('li');
      li.textContent = `${a.titel} — ${a.hinweis}`;
      return li;
    }));
  });

  $('physio-load').addEventListener('click', async () => {
    const p = await (await fetch('./data/physiologie-profile.json', { cache: 'no-store' })).json();
    $('physio-out').textContent = JSON.stringify(p, null, 2);
  });

  $('g6b-validate').addEventListener('click',()=>{
    const v=validateG6B(g6bModel);$('g6b-out').textContent=json(v.ok?{validierung:v,bilanz:balanceFlow(g6bModel),berechnung:simulateG6B(g6bModel),quelle:'synthetisch-browser-demo; keine physiologische Validierung'}:{validierung:v});
  });
  $('pbpk-run').addEventListener('click',()=>{try{outputSimulation();}catch(e){$('pbpk-out').textContent=`Abgewiesen: ${e.message}`;}});
  $('sim-event').addEventListener('click',()=>{try{
    const event={typ:$('event-type').value,t_h:number('event-time'),modellmenge:number('event-amount')};
    const next=[...simEvents,event];simulateCaffeine({...params(),events:next});simEvents=next;
    $('simzeit-out').textContent=json(simEvents);outputSimulation();
  }catch(e){$('simzeit-out').textContent=`Abgewiesen: ${e.message}`;}});
  $('event-clear').addEventListener('click',()=>{simEvents=[];$('simzeit-out').textContent='Ereignisse zurückgesetzt.';outputSimulation();});
  $('model-apply').addEventListener('click',()=>{try{
    const model=JSON.parse($('model-json').value),v=validateG6B(model);if(!v.ok)throw Error(v.fehler.join(' '));
    g6bModel=model;$('model-status').textContent='Modell übernommen. Quelle: synthetisch-browser-demo; keine fachliche Freigabe.';
  }catch(e){$('model-status').textContent=`Abgewiesen: ${e.message}`;}});
  $('model-code').addEventListener('click',()=>{const v=validateG6B(g6bModel);$('model-code-out').textContent=v.ok?`import { simulateG6B } from './lib/g6b.js';\nconst model = ${json(g6bModel)};\nconsole.log(simulateG6B(model));`:v.fehler.join(' ');});
  $('sim-save').addEventListener('click',async()=>{try{
    const parameter=params(),punkte=simulateCaffeine(parameter);await idbPut('simlaeufe',{ts:new Date().toISOString(),modell:structuredClone(g6bModel),parameter,ereignisse:structuredClone(simEvents),punkte});$('compare-out').textContent='Lauf gespeichert.';
  }catch(e){$('compare-out').textContent=`Abgewiesen: ${e.message}`;}});
  $('sim-compare').addEventListener('click',async()=>{
    const runs=await idbAll('simlaeufe');if(runs.length<2){$('compare-out').textContent='Mindestens zwei Läufe nötig.';return;}
    const a=runs.at(-2),b=runs.at(-1);const map=new Map(a.punkte.map(p=>[p.t_h,p]));
    const deltas=b.punkte.filter(p=>map.has(p.t_h)).map(p=>({t_h:p.t_h,...Object.fromEntries(['blut_mg','leber_mg','rest_mg'].map(k=>[k,p[k]-map.get(p.t_h)[k]]))}));
    $('compare-out').textContent=json({a_ts:a.ts,b_ts:b.ts,a_parameter:a.parameter,b_parameter:b.parameter,vergleichbare_zeitpunkte:deltas.length,wertevergleich:deltas});
  });
  $('sim-restore').addEventListener('click',async()=>{
    const run=(await idbAll('simlaeufe')).at(-1);if(!run?.modell||!run.parameter||!run.ereignisse){$('compare-out').textContent='Kein vollständiger Arbeitsstand vorhanden.';return;}
    const v=validateG6B(run.modell);if(!v.ok){$('compare-out').textContent='Gespeichertes Modell ungültig.';return;}
    simulateCaffeine(run.parameter);g6bModel=structuredClone(run.modell);simEvents=structuredClone(run.ereignisse);$('pbpk-dose').value=run.parameter.dose_mg;$('model-json').value=json(g6bModel);$('simzeit-out').textContent=json(simEvents);outputSimulation();$('compare-out').textContent=`Arbeitsstand wiederaufgenommen: ${run.ts}`;
  });

  $('note-save').addEventListener('click', async () => {
    const text = $('note-text').value.trim();
    if (!text) return;
    await idbPut('notizen', { text, ts: new Date().toISOString() });
    await notes();
    $('note-text').value = '';
  });

  $('mandant-sel').value=scope();$('mandant-status').textContent=`Aktiv: ${scope()}`;
  $('mandant-set').addEventListener('click',async()=>{
    clearTimeout(nudgeTimer);localStorage.setItem('dht-zweckbereich',$('mandant-sel').value);resetDrafts();lastLab=null;simEvents=[];
    g6bModel=await (await fetch('./data/g6b-minimal.json')).json();$('model-json').value=json(g6bModel);$('pbpk-dose').value=100;
    for(const id of ['lab-out','health-out','ocr-out','narrator-text','ziel-out','compare-out','model-status','model-code-out','simzeit-out','pbpk-out','nudge-status','export-status'])$(id).textContent='';
    $('note-text').value='';$('mandant-status').textContent=`Aktiv: ${scope()} · getrennte lokale Datenbank`;
    await profile();await notes();await drawVerlauf();await challenge();await reminders();await refreshDashboard();
  });
  $('profile-save').addEventListener('click',async()=>{
    const alias=$('profile-alias').value.trim();if(!alias||!$('consent').checked){$('profile-status').textContent='Alias und Einwilligung erforderlich.';return;}
    await idbPut('profil',{id:1,alias,consent:true,version:1,ts:new Date().toISOString()});await profile();
  });
  $('export-json').addEventListener('click',()=>exportLocal('json'));
  $('export-pdf').addEventListener('click',()=>exportLocal('pdf'));
  $('export-clear').addEventListener('click',async()=>{
    clearTimeout(nudgeTimer);resetDrafts();for(const store of STORES)await idbClear(store);
    lastLab=null;simEvents=[];g6bModel=await (await fetch('./data/g6b-minimal.json')).json();$('model-json').value=json(g6bModel);$('pbpk-dose').value=100;
    for(let i=localStorage.length-1;i>=0;i--){const key=localStorage.key(i);if(key.startsWith(`dht-${scope()}-`))localStorage.removeItem(key);}
    for(const id of ['lab-out','health-out','ocr-out','narrator-text','ziel-out','model-status','model-code-out','simzeit-out','pbpk-out','nudge-status'])$(id).textContent='';
    $('note-text').value='';await profile();await notes();await challenge();await reminders();await drawVerlauf();await refreshDashboard();
    const msg=`Lokale Stores geleert: ${STORES.length} · aktiver Zweck ${scope()}; Bereichswahl bleibt erhalten, anderer Zweck bleibt getrennt.`;$('compare-out').textContent=msg;$('export-status').textContent=msg;
  });
  await profile();await notes();await challenge();await reminders();
  await refreshDashboard();
  await drawVerlauf();
  enableOfflineCache(new URL(document.querySelector('meta[name="dht-selection-root"]').content, document.baseURI));
  document.documentElement.dataset.ready = 'true';
  if (window.DHT_VOLL_TEST) window.DHT_VOLL_TEST.ready = true;
}

init().catch((err) => {
  document.documentElement.dataset.error = err.message;
});
