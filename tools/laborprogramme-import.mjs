#!/usr/bin/env node
/**
 * Erzeugt src/data/laborprogramme.json aus den GOÄ-CSV (Semikolon, UTF-8).
 * CSV-Pfade: CLI-Argumente oder Default unter ~/Cortex/outputs/Laborprogramme-Uebernahme-20261101/
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const defaultDir = join(homedir(), 'Cortex/outputs/Laborprogramme-Uebernahme-20261101');

const overviewPath = process.argv[2] ?? join(defaultDir, 'laborprogramme_uebersicht.csv');
const ziffernPath = process.argv[3] ?? join(defaultDir, 'laborprogramme_ziffern.csv');
const outPath = process.argv[4] ?? join(repoRoot, 'src/data/laborprogramme.json');

/** @type {Record<string, { slug: string, organ_id?: string, image_folder?: string }>} */
const PROGRAM_META = {
  'LABOR - STATUS: BASELINE': {
    slug: 'labor-basis-check',
    organ_id: 'herz-male',
    image_folder: 'Basis-Check',
  },
  'LABOR - STATUS: ADVANCED': {
    slug: 'labor-erweiterter-check',
    organ_id: 'herz-male',
    image_folder: 'Erweiterter-Check',
  },
  'LABOR - STATUS: PREVENT': {
    slug: 'labor-vorsorge-check',
    organ_id: 'herz-male',
    image_folder: 'Vorsorge-Check',
  },
  'LABOR - STATUS: METABOLIC': {
    slug: 'labor-stoffwechsel-werte',
    organ_id: 'leber-male',
    image_folder: 'Stoffwechsel-Werte',
  },
  'LABOR - STATUS: RISK': {
    slug: 'labor-risikoprofil',
    organ_id: 'herz-male',
    image_folder: 'Risikoprofil',
  },
  'LABOR - SYSTEM: IMMUNE': {
    slug: 'labor-immunprofil',
    organ_id: 'lunge-male',
    image_folder: 'Immunprofil',
  },
  'LABOR - SYSTEM: LIVER': {
    slug: 'labor-leberwerte',
    organ_id: 'leber-male',
    image_folder: 'Leberwerte',
  },
  'LABOR - SYSTEM: RENAL': {
    slug: 'labor-nierenwerte',
    organ_id: 'niere-male',
    image_folder: 'Nierenwerte',
  },
};

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  const header = lines[0].split(';');
  return lines.slice(1).map((line) => {
    const values = line.split(';');
    /** @type {Record<string, string>} */
    const row = {};
    header.forEach((key, i) => {
      row[key] = values[i] ?? '';
    });
    return row;
  });
}

/** @param {string} raw */
function parseDecimal(raw) {
  return Number.parseFloat(String(raw).replace(',', '.'));
}

/** @param {number} amount */
export function formatGoaeEur(amount) {
  return `${amount.toFixed(2).replace('.', ',')}\u00a0€`;
}

/** @param {string[]} ziffern */
function groupZiffern(ziffern) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const z of ziffern) {
    const key = z.trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'de'))
    .map(([z, n]) => (n > 1 ? `${z} (${n}×)` : z))
    .join(', ');
}

const overviewRows = parseCsv(readFileSync(overviewPath, 'utf8'));
const ziffernRows = parseCsv(readFileSync(ziffernPath, 'utf8'));

/** @type {Map<string, object[]>} */
const positionenByProgram = new Map();
for (const row of ziffernRows) {
  const program = row.programm;
  if (!positionenByProgram.has(program)) positionenByProgram.set(program, []);
  const betrag = parseDecimal(row.betrag_eur);
  positionenByProgram.get(program).push({
    position: Number.parseInt(row.position, 10),
    ziffer: row.ziffer,
    bezeichnung: row.bezeichnung,
    faktor: parseDecimal(row.faktor),
    betrag_eur: betrag,
    betrag_display: formatGoaeEur(betrag),
  });
}

const programmes = overviewRows.map((row) => {
  const shop_name = row.programm;
  const meta = PROGRAM_META[shop_name];
  if (!meta) {
    throw new Error(`Unbekanntes Programm in Übersicht-CSV: ${shop_name}`);
  }
  const goae_summe_eur = parseDecimal(row.goae_summe_eur);
  const anzahl_ziffern = Number.parseInt(row.anzahl_ziffern, 10);
  const ziffernRaw = row.goae_ziffern.split(',').map((z) => z.trim()).filter(Boolean);
  const positionen = (positionenByProgram.get(shop_name) ?? []).sort(
    (a, b) => a.position - b.position,
  );
  const sumPositionen = Math.round(positionen.reduce((s, p) => s + p.betrag_eur, 0) * 100) / 100;
  if (Math.abs(sumPositionen - goae_summe_eur) > 0.02) {
    throw new Error(
      `${shop_name}: Summe Positionen ${sumPositionen} ≠ GOÄ-Summe ${goae_summe_eur}`,
    );
  }

  return {
    shop_name,
    praxis_name: row.praxis_bezeichnung,
    praxis_slug: meta.slug,
    goae_summe_eur,
    goae_summe_display: formatGoaeEur(goae_summe_eur),
    anzahl_ziffern,
    ziffern_gruppiert: groupZiffern(ziffernRaw),
    positionen,
    organ_id: meta.organ_id ?? null,
    image_webp: meta.image_folder ? `/images/labor/${meta.slug}.webp` : null,
  };
});

const payload = {
  generated_at: new Date().toISOString().slice(0, 10),
  source: {
    overview_csv: overviewPath,
    ziffern_csv: ziffernPath,
  },
  disclaimer_du:
    'Die gesetzlichen Krankenkassen erstatten die Kosten dieser Leistung nicht. Private Krankenversicherungen erstatten sie im Regelfall — frag aber sicherheitshalber vorher bei deiner Versicherung nach. Ansonsten gilt der Preis für Selbstzahler; die Abrechnung erfolgt nach der Gebührenordnung für Ärzte (GOÄ).',
  infobox_heading: 'Transparente Abrechnung nach GOÄ',
  programmes,
};

writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(`Wrote ${programmes.length} programmes → ${outPath}`);
