/** Regelbasierte Kurzerklärung — kein Cloud-Modell, keine Diagnose. */
const RULES = [
  {
    wenn: (ctx) => ctx.marker === 'hba1c' && ctx.wert > 6.5,
    text: 'Der eingegebene HbA1c-Wert liegt über dem üblichen Referenzbereich — bitte mit Ihrer Ärztin/Ihrem Arzt besprechen (keine Diagnose hier).',
  },
  {
    wenn: (ctx) => ctx.marker === 'ruhepuls' && ctx.wert > 100,
    text: 'Ein erhöhter Ruhepuls kann viele Ursachen haben — Messung wiederholen und ärztlich einordnen.',
  },
  {
    wenn: () => true,
    text: 'Keine regelbasierte Zusatzinfo — Werte nur als Orientierung notiert.',
  },
];

export function explainValue(ctx) {
  for (const r of RULES) {
    if (r.wenn(ctx)) return r.text;
  }
  return '';
}
