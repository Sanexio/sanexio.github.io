/** Neutrale dokumentierte Messung ohne Schwellen oder Einordnung. */
export function explainValue(ctx) {
  if (!ctx || !Number.isFinite(Number(ctx.wert))) return 'Keine eigenen Daten vorhanden. Die Einordnung erfolgt ärztlich.';
  return `${ctx.marker || 'Messwert'}: ${Number(ctx.wert).toLocaleString('de-DE')} ${ctx.einheit || ''}. Kein Vergleichsbereich angegeben. Die Einordnung erfolgt ärztlich.`;
}
