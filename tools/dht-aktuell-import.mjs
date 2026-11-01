#!/usr/bin/env node
/** Manueller Trunk → src/data Import; kein Trunk-Zugriff beim Website-Build.
 * Schema: heading, lead, note? und items: [{title, description, href?}].
 * Texte dürfen auch Sprachobjekte {de: ...} sein.
 * Aufruf wie laborprogramme-import.mjs: [Quelle.yaml] [Ziel.json].
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
// Bereits im Astro-Lockfile vorhanden; keine zusätzliche Abhängigkeit.
import { parse } from 'yaml';

const source = process.argv[2] ?? join(homedir(), 'Cortex/projects/Sanexio-Tenant/trunk/content/pages/_shared/dht-aktuell.yaml');
const target = process.argv[3] ?? fileURLToPath(new URL('../src/data/dht-aktuell.json', import.meta.url));
if (!existsSync(source)) {
  console.log('Trunk-Block noch nicht vorhanden; vorhandene DHT-Daten bleiben erhalten.');
} else {
  const raw = parse(readFileSync(source, 'utf8'));
  const text = (value, field, optional = false) => {
    const result = typeof value === 'object' && value !== null ? value.de : value;
    if (optional && result == null) return '';
    if (typeof result !== 'string' || !result.trim()) throw new Error(`Ungültiger Text: ${field}`);
    return result;
  };
  if (!Array.isArray(raw?.items) || raw.items.length < 1 || raw.items.length > 4) {
    throw new Error('DHT aktuell benötigt 1–4 items; Zieldatei bleibt unverändert.');
  }
  const items = raw.items.map((item, i) => {
    const href = text(item.href, `items[${i}].href`, true);
    if (href && !/^\/(?!\/)[^\s\\]*$/.test(href)) throw new Error('DHT-Verweise müssen lokale Website-Pfade sein.');
    return { title: text(item.title, `items[${i}].title`), description: text(item.description, `items[${i}].description`), href };
  });
  if (new Set(items.map(item => item.title)).size !== items.length) throw new Error('Doppelte DHT-Beiträge');
  const data = { source: 'trunk', heading: text(raw.heading, 'heading'), lead: text(raw.lead, 'lead'), note: text(raw.note, 'note', true), items };
  writeFileSync(target, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`DHT aktuell: ${items.length} Einträge importiert.`);
}
