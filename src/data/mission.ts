// Sanexio mission pillars — four values that define the company DNA.
// Editable by Dr. Stracke; current text is Phase-3 proposal.

export interface MissionPillar {
  id: string;
  title: string;
  body: string;
  accent: 'pulse' | 'data' | 'tech' | 'vital';
}

export const missionPillars: MissionPillar[] = [
  {
    id: 'evidence-based',
    title: 'Evidence-Based',
    body: 'Jeder Datenpunkt im Digital Health Twin ist klinisch validiert. Keine Wellness-Esoterik, keine ungeprüften Versprechen — nur Werte, die in der ärztlichen Praxis Bestand haben.',
    accent: 'pulse',
  },
  {
    id: 'patient-first',
    title: 'Patient-First',
    body: 'Der digitale Zwilling gehört dem Patienten, nicht der Plattform. Datensouveränität, Transparenz und Exportierbarkeit sind keine Features, sondern Voraussetzungen.',
    accent: 'data',
  },
  {
    id: 'open-knowledge',
    title: 'Open Knowledge',
    body: 'Der Health Graph und die zugrundeliegenden Forschungsergebnisse sind transparent, nachvollziehbar und überprüfbar. Wir arbeiten mit der medizinischen Community, nicht gegen sie.',
    accent: 'tech',
  },
  {
    id: 'clinically-validated',
    title: 'Klinisch validiert',
    body: 'Jede Methode wird in der Partnerpraxis Dr. Stracke & Kollegen am echten Patienten geprüft, bevor sie zum Produkt wird. Die Praxis ist der Realitätscheck — kein Fokustest, keine Persona-Studie.',
    accent: 'vital',
  },
];
