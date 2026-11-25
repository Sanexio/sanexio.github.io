// Only the register determines terminology and binding eligibility.
export const femaleFitNote = 'Illustrative Einpassung: 761 von 868 Strukturen. Nicht enthalten u. a.: Leberflächen und Leberbänder, Nierenkapseln und äußere Nierenrinde, große Beinknochen. Keine anatomische Registrierung; keine Aussage über Lage oder Größe eines Organs bei einer Person.';
export function femaleCounts(register) {
  const counts = {secured: 0, probable: 0, unnamed: 0, rejected: 0};
  for (const e of register.entries) {
    if (e.quality === 'gesichert') counts.secured++;
    else if (e.quality === 'wahrscheinlich') counts.probable++;
    else if (['nicht zuordenbar', 'verworfen'].includes(e.quality)) {
      counts.unnamed++;
      if (e.quality === 'verworfen') counts.rejected++;
    } else throw new Error('Unbekannte Benennungsstufe im weiblichen Register');
  }
  return counts;
}

export function femaleNote(register) {
  const c = femaleCounts(register);
  return `Weibliche Teilansicht: ${c.secured} Strukturen gesichert benannt · ${c.probable} wahrscheinlich · ${c.unnamed} noch nicht zugeordnet (davon ${c.rejected} Zuordnungen verworfen). ${register.warning}`;
}
