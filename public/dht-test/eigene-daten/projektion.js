import {datum,organIds} from '../eigene-daten/vertrag/pruefen.js';
export {datum};
export const zahl = n => new Intl.NumberFormat('de-DE',{maximumFractionDigits:3}).format(n);
export const absolut = zeit => datum(zeit).toLocaleDateString('de-DE', zeit.genauigkeit === 'monat' ? {month:'long',year:'numeric'} : {day:'2-digit',month:'2-digit',year:'numeric'});
export function relativ(zeit) {
  if (zeit.genauigkeit === 'monat') return 'Messmonat';
  const days = zeit.tageVorHeute ?? Math.round((datum({tageVorHeute:0,genauigkeit:'tag'})-datum(zeit))/86400000);
  return days === 0 ? 'heute' : days === 1 ? 'vor einem Tag' : `vor ${days} Tagen`;
}
export function abweichung(d) {
  const c=d.vergleich, v=d.wert;
  if (!c || (c.unten === undefined && c.oben === undefined) || typeof v !== 'number') return 'kein Vergleichsbereich angegeben';
  if (c.oben !== undefined && v > c.oben) return `liegt ${zahl(v-c.oben)} ${d.einheit} über dem oberen Vergleichswert`;
  if (c.unten !== undefined && v < c.unten) return `liegt ${zahl(c.unten-v)} ${d.einheit} unter dem unteren Vergleichswert`;
  return 'liegt innerhalb des angegebenen Vergleichsbereichs';
}
export function reihen(data,mapping) {
  const groups=new Map();
  for (const d of data.filter(d=>d.art==='messwert'&&d.bestaetigt)) {
    const key=[d.loinc.system,d.loinc.code,d.einheit,d.quelle.format,d.quelle.bezeichnung].join('|');
    if(!groups.has(key)) groups.set(key,{key,organe:organIds(d,mapping),werte:[]});
    groups.get(key).werte.push(d);
  }
  return [...groups.values()].map(g=>({...g,werte:g.werte.sort((a,b)=>datum(a.zeit)-datum(b.zeit))}));
}

export function bereichText({vergleich,einheit}) {
  if (!vergleich) return 'Kein Bereich im Befund';
  const {unten,oben,text} = vergleich;
  if (unten !== undefined && oben !== undefined) return `${zahl(unten)}–${zahl(oben)} ${einheit}`;
  if (unten !== undefined) return `ab ${zahl(unten)} ${einheit}`;
  if (oben !== undefined) return `bis ${zahl(oben)} ${einheit}`;
  return text || 'Kein Bereich im Befund';
}

export function verlaufsText(werte) {
  if (werte.length < 2) return '';
  const first = werte[0], last = werte.at(-1);
  if (!Number.isFinite(first.wert) || !Number.isFinite(last.wert) ||
      first.einheit !== last.einheit || datum(first.zeit) >= datum(last.zeit)) return '';
  const delta = last.wert - first.wert;
  const magnitude = Math.abs(delta);
  const amount = magnitude && magnitude < .001
    ? magnitude.toLocaleString('de-DE',{maximumSignificantDigits:2}) : zahl(magnitude);
  const change = delta === 0 ? 'gleicher Wert' :
    `um ${amount} ${last.einheit} ${delta > 0 ? 'gestiegen' : 'gesunken'}`;
  return `Seit ${absolut(first.zeit)}: ${change} (rechnerisch).`;
}
