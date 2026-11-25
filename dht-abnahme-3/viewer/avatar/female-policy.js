import {germanOrganName} from './organnamen.js';
export {femaleCounts, femaleNote, femaleFitNote} from './female-summary.js';

export function femaleLabel(e) {
  if (!['gesichert', 'wahrscheinlich'].includes(e.quality)) return 'noch nicht benannt';
  const name = [e.names?.de || germanOrganName(e), e.names?.la].flat().filter(Boolean).join(' · ') || e.source_label;
  if (!name) throw new Error('Belegter Name fehlt');
  if (e.quality === 'wahrscheinlich') return `${name} · wahrscheinlich`;
  return e.mapping_scope === 'inherited_broader_concept' ? `Gesicherter Oberbegriff: ${name} (keine Einzelidentität)` : name;
}

export const femaleBindingAllowed = e => e?.quality === 'gesichert' && e.mapping_scope !== 'inherited_broader_concept' && Boolean(e.ta2_id);
