// Anzeigenamen nur für sanexio.github.io (Entscheid Dr. Stracke, 28.11.2026: „Nur auf der Pitch-Seite“).
// Der gemeinsame Bestand (untersuchungen.json, laborprogramme.json) bleibt unverändert.
export const ANZEIGENAMEN: Record<string, string> = {
  'Stoffwechsel-Werte': 'Stoffwechselwerte',
  'Spirometrie - Lungenfunktion': 'Lungenfunktion (Spirometrie)',
  'Ultraschall: Bauchorgane': 'Ultraschall der Bauchorgane',
  'Ultraschall: Komplett Check': 'Ultraschall-Komplettcheck',
  'Ultraschall: Bauchspeicheldrüse': 'Ultraschall der Bauchspeicheldrüse',
  'Ultraschall: Leber und Gallenblase': 'Ultraschall von Leber und Gallenblase',
  'Ultraschall: Nieren und Harnwege': 'Ultraschall von Nieren und Harnwegen',
  'Ultraschall: Prostata und Harnblase': 'Ultraschall von Prostata und Harnblase',
  'Ultraschall: Schilddrüse': 'Ultraschall der Schilddrüse',
  'Carotis-Duplex': 'Ultraschall der Halsschlagadern (Carotis-Duplex)',
  'Echokardiographie': 'Herzultraschall (Echokardiographie)',
  'Tauchtauglichkeit': 'Untersuchung zur Tauchtauglichkeit',
  'Gesundheits-Check (FINDRISK · CV-Risiko · Leber)': 'Gesundheits-Check (FINDRISK, Herz-Kreislauf-Risiko, Leber)',
};
export const anzeigename = (name: string): string => ANZEIGENAMEN[name] ?? name;