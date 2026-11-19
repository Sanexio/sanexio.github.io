import {mountEigeneDaten} from './eigene-daten/einstieg.js';
import { femaleNote, femaleCounts, femaleFitNote } from './avatar/female-policy.js';
import { mountLazyFeatures } from './avatar/lazy-features.js';
import { enableOfflineCache } from './offline-cache.js';
let avatarView = null, viewGeneration = 0, avatarTimer, avatarAbort;
let femaleRegister;
async function loadAvatar() {
clearTimeout(avatarTimer);
avatarAbort?.abort();
const abort = avatarAbort = new AbortController();
const generation = ++viewGeneration, sex = state.darstellung.geschlecht;
const toolbar=document.querySelector('.anatomie-toolbar');if(toolbar&&$('avatar-stage').contains(toolbar))$('text-path-note').before(toolbar);
avatarView?.dispose(); avatarView = null;
const host = document.createElement('div'); host.id = 'avatar-stage';
$('avatar-stage').replaceWith(host);
host.innerHTML = '<p role="status">3D wird nachgeladen. Die Regionsauswahl ist bereits bedienbar.</p><progress aria-label="3D wird nachgeladen"></progress>';
try {
let view;
if (sex === 'weiblich') {
femaleRegister ||= await (await fetch('./avatar/female-register.json')).json();
if (generation !== viewGeneration) return;
renderFemaleNotice();
const {createFemaleView} = await import('./avatar/female-view.js');
if (generation !== viewGeneration) return;
view = await createFemaleView(host, femaleRegister, {signal:abort.signal,onDataOrgan:id=>eigeneDaten.organGewaehlt(id)});
if(generation===viewGeneration)renderFemaleNotice();
} else {
const {createAvatarView} = await import('./avatar/avatar-view.js');
if (generation !== viewGeneration) return;
view = await createAvatarView(host, {onRegion: id=>{if(document.querySelector('.app').dataset.mode==='pain')selectRegion(id);}, signal:abort.signal,onDataOrgan:id=>eigeneDaten.organGewaehlt(id)});
}
if (generation !== viewGeneration) {view.dispose(); return;}
avatarView = view; eigeneDaten.avatarBereit(); renderAvatar(); renderSchicht(); renderSpotLabels();
if (state.region) {focusedRegion = state.region.id; view.focusRegion?.(focusedRegion);}
$('ladefehler').hidden = true; delete document.documentElement.dataset.error;
} catch (err) {
if (generation !== viewGeneration) return;
host.setAttribute('aria-busy','false');
for (const progress of host.querySelectorAll('progress')) progress.hidden = true;
$('ladefehler').hidden = false;
$('ladefehler').textContent = `3D nicht verfügbar: ${err.message}. Die Regionsknöpfe bleiben bedienbar.`;
const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = '3D erneut laden'; retry.addEventListener('click',loadAvatar); host.append(retry);
// A 3D failure must never revoke text workflow readiness.
document.documentElement.dataset.avatarError = err.message;
}
}
let technikEnabled = false;
let femaleAvailability = '';
function renderFemaleNotice(){
const note=$('female-standhinweis');note.replaceChildren();
const details=document.createElement('details'),summary=document.createElement('summary');
summary.className='female-core';summary.textContent='Weibliche Teilansicht – einige Strukturen fehlen noch';
const c=femaleRegister && femaleCounts(femaleRegister);
const full=document.createElement('p');full.textContent=c ? `${femaleAvailability} ${femaleNote(femaleRegister)}` : 'Teilansicht wird geprüft.';
const fit=document.createElement('p');fit.className='female-fit';fit.textContent=femaleFitNote;
const reason=document.createElement('p');reason.id='female-selection-reason';reason.textContent='Schmerzortübernahme und Lexikonbindung sind in der weiblichen Teilansicht gesperrt: Für diese Netze fehlt eine geprüfte Bindung an den Alltagssprachkatalog. Ein gesicherter Name allein belegt diese Beziehung nicht.';
details.append(summary,full,fit,reason);note.append(details);
let technical=$('female-fit-technical');if(!technical){technical=document.createElement('p');technical.id='female-fit-technical';$('technical-info')?.append(technical);}technical.textContent=[full.textContent,femaleFitNote,reason.textContent].join(' ');technical.hidden=false;
}


let focusedRegion = null;
const state = {
katalog: null,
lexikon: null,
region: null,
struktur: null,
feiner: null,
seiteGewaehlt: null,
orte: [],
schritt: 1,
darstellung: { geschlecht: 'maennlich', schicht: 'haut', labels: false, scale: 1 },
};

const $ = (id) => document.getElementById(id);

function setStep(n, focus = true) {
document.querySelector('.app').dataset.step = n;
state.schritt = n;
for (const el of document.querySelectorAll('.step')) {
el.dataset.active = String(Number(el.dataset.step) === n);
}
$('schritt-region').classList.remove('hidden');
$('schritt-struktur').classList.toggle('hidden', n !== 2);
$('schritt-seite').classList.toggle('hidden', n !== 3);
$('schritt-fein').classList.toggle('hidden', n !== 4);
$('schritt-ausgabe').classList.toggle('hidden', n !== 5);
if (focus) {
const target = $(['','hotspots','schritt-struktur','schritt-seite','schritt-fein','schritt-ausgabe'][n]);
const control = target?.querySelector('button:not([disabled]),input:not([disabled])');
control?.focus({preventScroll:true});
target?.scrollIntoView({block:'start',behavior:'instant'});
}
}

function resolvedTa2(struktur, seite) {
if (struktur.seite_abfragen && struktur.ta2_paar && seite) {
return struktur.ta2_paar[seite] || struktur.ta2_kennung;
}
return struktur.ta2_kennung;
}

function ortFromDraft() {
if (!state.region || !state.struktur || !state.feiner) return null;
const seite = state.seiteGewaehlt ?? state.struktur.seite ?? null;
const ort = {
region: state.region.label,
struktur_alltagssprache: state.struktur.label,
feiner: state.feiner.label,
feiner_id: state.feiner.id,
ta2_kennung: resolvedTa2(state.struktur, seite),
seite,
};
if (state.struktur.feiner_modus === 'verlauf') {
ort.ausstrahlung_verlauf = state.feiner.label;
ort.angabe_typ = 'verlauf';
}
return ort;
}

function renderHerkunft() {
const box = $('herkunft-inhalt');
if (!box || !state.katalog) return;
const m = state.katalog.erzeugt_aus || {};
const regionen = state.katalog.regionen?.length ?? 0;
const strukturen = (state.katalog.regionen || []).reduce((n, r) => n + (r.strukturen?.length || 0), 0);
const lines = [
'Diese Auswahl ist keine Diagnose und enthält keine Dosierung oder Therapieempfehlung.',
'',
`Katalog: ${m.katalog_pfad || '—'} (${m.katalog_sha256 ? `SHA-256 ${m.katalog_sha256.slice(0, 16)}…` : 'Hash unbekannt'})`,
`Patientenauswahl: ${regionen} Körperregionen, ${strukturen} Bereiche in Alltagssprache; 3D-Register separat mit 1.559 Einträgen.`,
m.org1_auswahl ? `Organ-/Makrozuteil: ${m.org1_auswahl}` : '',
m.nrv1_auswahl ? `Nerven-/Rückenanteil: ${m.nrv1_auswahl}` : '',
'',
'Browser: lokales WebGL (three.js r180), männliche AHF2-Studienhülle und KMS2-Atlas. Dreieckstreffer, räumliche Labels und Kamerazoom. Gewebe/Zelle/Molekül nicht vorhanden.',
'3D-Quellen: Z-Anatomy — Gauthier Kervyn, Marcin Zielinski (CC BY-SA 4.0); BodyParts3D — Database Center for Life Science (CC BY-SA 2.1 Japan). three.js: MIT. Einzelobjekte und Prüfsummen im lokalen Avatar-Manifest. Offene anatomische Einzelabnahmen bleiben offen.',
].filter(Boolean);
box.textContent = lines.join('\n');
}

function buildPayload() {
if (state.darstellung.geschlecht === 'weiblich') return null;
if (!state.orte.length) return null;
return {
schema: 'dht-patient-auswahl/2',
orte: state.orte.map((o) => ({ ...o })),
erfasst_am: new Date().toISOString(),
hinweis: state.katalog.hinweis_patient,
diagnose: false,
};
}

function renderSchicht() { avatarView?.setLayer(state.darstellung.schicht)?.catch(err=>{$('ladefehler').hidden=false;$('ladefehler').textContent='Diese Schicht konnte nicht geladen werden. Bitte erneut wählen.';}); }
function renderAvatar() { avatarView?.setOpacity(Number($('huelle-alpha').value)/100); }
function renderSpotLabels() { avatarView?.setLabels(state.darstellung.labels); }

function updateZoomKette() {
const el = $('zoom-kette');
if (!el) return;
const parts = ['Körper'];
if (state.region) parts.push(state.region.label);
if (state.struktur) parts.push(state.struktur.label);
if (state.feiner) parts.push(state.feiner.label);
el.textContent = parts.join(' → ');
if (state.region && state.region.id !== focusedRegion) { focusedRegion=state.region.id; avatarView?.focusRegion(focusedRegion); }
}

async function showLexikonForStruktur(s) {
if(!state.lexikon){try{const r=await fetch('./lexikon-snippets.json');if(r.ok)state.lexikon=await r.json();}catch{}}
if(state.struktur !== s)return;
const box = $('lexikon-text');
if (!box || !s) return;
const txt = state.lexikon?.eintraege?.[s.ta2_kennung];
if (txt) {
box.hidden = false;
box.textContent = txt;
} else {
box.hidden = true;
box.textContent = '';
}
}

function renderHotspots() {
const box = $('hotspots'); box.replaceChildren();
for (const region of state.katalog.regionen) {
const button=document.createElement('button');button.type='button';button.className='secondary';
button.dataset.regionId=region.id;button.textContent=region.label;
button.addEventListener('click',()=>selectRegion(region.id));box.append(button);
}
}

function selectRegion(regionId) {
if (state.darstellung.geschlecht === 'weiblich') return;
state.region = state.katalog.regionen.find((r) => r.id === regionId);
state.struktur = null;
state.feiner = null;
state.seiteGewaehlt = null;
renderStrukturen();
$('region-titel').textContent = state.region.label;
updateZoomKette();
setStep(2);
}

function renderStrukturen() {
const list = $('struktur-liste');
list.replaceChildren();
if (!state.region) return;
for (const s of state.region.strukturen) {
const btn = document.createElement('button');
btn.type = 'button';
btn.className = 'choice';
btn.dataset.selected = String(state.struktur?.id === s.id);
const seiteHint = s.seite ? ` · ${s.seite}` : s.seite_abfragen ? ' · Seite wählen' : '';
btn.innerHTML = `${s.label}<small>Für Ihre Akte: ${s.ta2_kennung}${seiteHint}</small>`;
btn.addEventListener('click', () => {
state.struktur = s;
state.feiner = null;
state.seiteGewaehlt = s.seite_abfragen ? null : s.seite ?? null;
renderStrukturen();
$('struktur-titel').textContent = s.label;
showLexikonForStruktur(s);
updateZoomKette();
if (s.seite_abfragen) {
renderSeite();
setStep(3);
} else {
renderFeiner();
setStep(4);
}
});
list.append(btn);
}
}

function renderSeite() {
const box = $('seite-liste');
box.replaceChildren();
if (!state.struktur?.seite_abfragen) return;
for (const seite of ['links', 'rechts']) {
const id = `seite-${seite}`;
const row = document.createElement('label');
const input = document.createElement('input');
input.type = 'radio';
input.name = 'seite';
input.value = seite;
input.id = id;
input.checked = state.seiteGewaehlt === seite;
input.addEventListener('change', () => {
state.seiteGewaehlt = seite;
updatePreview();
});
row.append(input, document.createTextNode(` ${seite === 'links' ? 'Links' : 'Rechts'}`));
box.append(row);
}
updatePreview();
}

function renderFeiner() {
const box = $('fein-liste');
box.replaceChildren();
if (!state.struktur) return;
const feinLead = $('fein-lead');
if (state.struktur.feiner_modus === 'verlauf') {
feinLead.textContent = 'Entlang welches Verlaufs?';
$('fein-hinweis').textContent = state.struktur.verlauf_hinweis || '';
$('fein-hinweis').style.color = '#4a5d73';
} else {
feinLead.textContent = 'Wo genau in dieser Region?';
$('fein-hinweis').textContent = '';
}
for (const f of state.struktur.feiner) {
const id = `fein-${f.id}`;
const row = document.createElement('label');
const input = document.createElement('input');
input.type = 'radio';
input.name = 'feiner';
input.value = f.id;
input.id = id;
input.checked = state.feiner?.id === f.id;
input.addEventListener('change', () => {
state.feiner = f;
updateZoomKette();
updatePreview();
});
row.append(input, document.createTextNode(` ${f.label}`));
box.append(row);
}
updatePreview();
}

function renderListe() {
const ul = $('orte-liste');
ul.replaceChildren();
if (!state.orte.length) {
const li = document.createElement('li');
li.className = 'muted';
li.textContent = 'Noch keine Stelle gewählt.';
ul.append(li);
return;
}
for (const [i, o] of state.orte.entries()) {
const li = document.createElement('li');
const seite = o.seite ? ` · ${o.seite}` : '';
li.textContent = `${o.region} · ${o.struktur_alltagssprache} · ${o.feiner}${seite}`;
const rm = document.createElement('button');
rm.type = 'button';
rm.className = 'linkish';
rm.textContent = 'Entfernen';
rm.addEventListener('click', () => {
state.orte.splice(i, 1);
renderListe();
updatePreview();
});
li.append(' ', rm);
ul.append(li);
}
}

function updatePreview() {
const draft = ortFromDraft();
const payload = buildPayload();
const preview = draft
? JSON.stringify({ entwurf: draft, gespeichert: payload?.orte ?? [] }, null, 2)
: payload
? JSON.stringify(payload, null, 2)
: '';
$('json-vorschau').textContent = technikEnabled ? preview : '';
$('json-vorschau').classList.toggle('hidden', !technikEnabled);
$('kopieren-json').classList.toggle('hidden', !technikEnabled);
$('schritt-ausgabe').querySelector('h2').textContent = technikEnabled ? 'Ihre Auswahl' : 'Ihre gewählten Stellen';
$('lokal-hinweis').hidden = technikEnabled;
const summary = $('ausgabe-liste'); summary.replaceChildren();
if (!technikEnabled) for (const o of state.orte) {
const li = document.createElement('li');
li.textContent = [o.region, o.struktur_alltagssprache, o.seite || 'nicht angegeben', o.feiner || 'nicht angegeben'].join(' · ');
summary.append(li);
}
summary.hidden = technikEnabled;
if (payload) {
$('ausgabe-text').textContent = payload.orte
.map((o) => `${o.region} · ${o.struktur_alltagssprache}${o.feiner ? ` · ${o.feiner}` : ''}`)
.join(' / ');
} else if (draft) {
$('ausgabe-text').textContent = `${draft.region} · ${draft.struktur_alltagssprache} (Entwurf)`;
} else {
$('ausgabe-text').textContent = '';
}
$('ausgabe-text').hidden = !technikEnabled;
$('fertig-uebernehmen').classList.toggle('hidden', !technikEnabled || !state.orte.length);
$('zusammenfassung').classList.toggle('hidden', technikEnabled || !state.orte.length);
renderListe();
}

function resetDraft() {
focusedRegion = null;
state.region = null;
state.struktur = null;
state.feiner = null;
state.seiteGewaehlt = null;
renderHotspots();
setStep(1);
$('fein-hinweis').textContent = '';
$('seite-hinweis').textContent = '';
updatePreview();
}

function addCurrentToList() {
if (state.struktur?.seite_abfragen && !state.seiteGewaehlt) {
$('seite-hinweis').textContent = 'Bitte wählen Sie links oder rechts.';
return;
}
if (!state.feiner) {
$('fein-hinweis').textContent = 'Bitte wählen Sie noch, wo genau in dieser Region es sitzt.';
return;
}
$('fein-hinweis').textContent = '';
$('seite-hinweis').textContent = '';
const ort = ortFromDraft();
if (!ort) return;
const dup = state.orte.some(
(o) =>
o.ta2_kennung === ort.ta2_kennung &&
o.feiner === ort.feiner &&
o.seite === ort.seite &&
o.region === ort.region
);
if (!dup) state.orte.push(ort);
resetDraft();
}

function confirmSelection() {
if (!state.orte.length) {
$('fein-hinweis').textContent = 'Bitte mindestens einen Schmerzort zur Liste hinzufügen.';
return;
}
const payload = buildPayload();
if (!payload) return;
updatePreview();
setStep(5);
if (!technikEnabled) return;
const msg = { type: 'dht-patient-auswahl', version: 2, payload };
if (window.parent !== window) window.parent.postMessage(msg, window.location.origin);
window.dispatchEvent(new CustomEvent('dht-patient-auswahl', { detail: payload }));
if (window.DHT_PATIENT_TEST) window.DHT_PATIENT_TEST.last = payload;
}

async function configureAvatarRelease() {
const release = await (await fetch('./avatar-release.json', {cache: 'no-cache'})).json();
$('avatar-geschlechtswahl').textContent = 'Männliche Darstellung';
if (!release.femaleAvatarEnabled) return;
femaleAvailability = release.availabilityNote;
const note = $('female-standhinweis');
const male = document.createElement('button'), female = document.createElement('button');
male.id = 'avatar-maennlich'; male.textContent = 'Männlich'; male.type = 'button'; male.setAttribute('aria-pressed', 'true');
female.id = 'avatar-weiblich'; female.textContent = 'Weiblich · Teilansicht'; female.type = 'button'; female.setAttribute('aria-pressed', 'false'); female.setAttribute('aria-describedby', note.id);
$('avatar-geschlechtswahl').replaceChildren(male, female);
let maleOpacity = $('huelle-alpha').value;
const disabledBefore = new Map();
async function switchSex(sex) {
if (state.darstellung.geschlecht === sex) return;
state.darstellung.geschlecht = sex;
document.querySelector('.app').dataset.sex = sex;
const isFemale = sex === 'weiblich';

if (isFemale) {maleOpacity = $('huelle-alpha').value; $('huelle-alpha').value = '100';}
else $('huelle-alpha').value = maleOpacity;
note.hidden = !isFemale;
if($('female-fit-technical'))$('female-fit-technical').hidden=!isFemale;
if(isFemale) renderFemaleNotice();

$('avatar-heading').textContent = isFemale ? 'Weiblicher 3D-Avatar — gekennzeichnete Teilansicht' : 'Männlicher 3D-Avatar — drehen, zoomen, antippen';
for (const el of document.querySelectorAll('#hotspots button, .layout > section:nth-child(2) button, .layout > section:nth-child(2) input, .layout > section:nth-child(2) select')) {
if (isFemale) {disabledBefore.set(el, el.disabled); el.disabled = true;}
else if (disabledBefore.has(el)) el.disabled = disabledBefore.get(el);
}
male.setAttribute('aria-pressed', String(!isFemale)); female.setAttribute('aria-pressed', String(isFemale));
await loadAvatar();
}
male.addEventListener('click', () => switchSex('maennlich'));
female.addEventListener('click', () => switchSex('weiblich'));
}

function setMode(mode){
 if(mode==='pain'&&eigeneDaten.publicExampleOnly){eigeneDaten.schmerzBeispiel();return;}
 const app=document.querySelector('.app');app.dataset.mode=mode;
 $('explore-tab').setAttribute('aria-selected',String(mode==='explore'));$('pain-tab').setAttribute('aria-selected',String(mode==='pain'));
 document.querySelector('header h1').textContent=mode==='explore'?'Körper erkunden':'Wo tut es weh?';
 const toolbar=document.querySelector('.anatomie-toolbar'),tech=$('technical-info');
 if(toolbar&&tech){if(mode==='explore')tech.append(toolbar);else $('text-path-note').before(toolbar);}
 if(avatarView)renderSchicht();
}
async function init() {
setMode(new URLSearchParams(location.search).get('modus')==='schmerz'?'pain':'explore');
document.addEventListener('avatar-layer',e=>{state.darstellung.schicht=e.detail.layer;$('schicht-wahl').value=e.detail.layer;});
$('explore-tab').addEventListener('click',()=>setMode('explore'));$('pain-tab').addEventListener('click',()=>setMode('pain'));
for(const id of ['explore-tab','pain-tab'])$(id).addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const target=e.key==='Home'?'explore-tab':e.key==='End'?'pain-tab':id==='explore-tab'?'pain-tab':'explore-tab';$(target).click();$(target).focus();}});

const [res] = await Promise.all([
 fetch('./katalog-patient.json'),
 configureAvatarRelease(),
 (async()=>{try { const r=await fetch('./technik-release.json',{cache:'no-store'});technikEnabled=r.ok&&(await r.json()).enabled===true;}catch{}})()
]);
if (!res.ok) throw new Error('Katalog nicht geladen');
state.katalog = await res.json();
renderHerkunft();
renderHotspots();
updatePreview();
setStep(1, false);
$('zurueck-region').addEventListener('click', () => setStep(1));
$('zurueck-struktur').addEventListener('click', () => setStep(2));
$('zurueck-seite').addEventListener('click', () => setStep(2));
$('weiter-fein').addEventListener('click', () => {
if (state.struktur?.seite_abfragen && !state.seiteGewaehlt) {
$('seite-hinweis').textContent = 'Bitte wählen Sie links oder rechts.';
return;
}
$('seite-hinweis').textContent = '';
renderFeiner();
setStep(4);
});
$('hinzufuegen').addEventListener('click', addCurrentToList);
$('fertig-uebernehmen').addEventListener('click', confirmSelection);
$('zusammenfassung').addEventListener('click', confirmSelection);
$('neu-start').addEventListener('click', () => {
state.orte = [];
resetDraft();
updatePreview();
});
$('huelle-alpha')?.addEventListener('input', () => renderAvatar());
$('schicht-wahl')?.addEventListener('change', (ev) => {
state.darstellung.schicht = ev.target.value;
$('huelle-alpha').value = ev.target.value === 'haut' ? 100 : 15;
renderAvatar(); renderSchicht();
});
$('labels-an')?.addEventListener('change', (ev) => {
state.darstellung.labels = ev.target.checked;
renderSpotLabels();
});
$('kopieren-json').addEventListener('click', async () => {
const payload = buildPayload();
if (!payload) return;
try {
await navigator.clipboard.writeText(JSON.stringify(payload));
$('kopier-status').textContent = 'JSON in Zwischenablage kopiert (nur auf diesem Gerät).';
} catch {
$('kopier-status').textContent = 'Kopieren nicht möglich — bitte JSON manuell markieren.';
}
});
const lazyFeatures=mountLazyFeatures();
if (parent !== window) import('./frame-height.js');
document.documentElement.dataset.ready='true';
performance.mark('dht-text-ready');
enableOfflineCache();
avatarTimer = setTimeout(loadAvatar, 0);
await lazyFeatures;

}

const eigeneDaten=mountEigeneDaten({avatar:()=>avatarView,geschlecht:()=>state.darstellung.geschlecht,katalog:()=>state.katalog});
init().catch((err) => {
document.documentElement.dataset.ready = 'false';
document.documentElement.dataset.error = err.message;
$('ladefehler').hidden = false;
$('ladefehler').textContent = `Start fehlgeschlagen: ${err.message}`;
});
