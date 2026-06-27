// DHT Timeline — five chronological phases of the Digital Health Twin
// rendered by DhtTimeline.astro. Order matters: index 0 → 4 = oldest → newest.
//
// HINWEIS: Alle Sanexio-Repositories sind PRIVAT, der DHT-Twin ist proprietär.
// Diese öffentliche Pitch-Seite verlinkt KEINE GitHub-Repos. Descriptions sind
// bewusst gleich lang gehalten, damit die Phasen-Karten symmetrisch wirken.

export interface DhtPhase {
  id: string;
  number: number;
  name: string;
  year: string;
  tagline: string;
  description: string;
  icon: 'concept' | 'bloodtest' | 'graph' | 'avatar' | 'brain';
}

export const dhtPhases: DhtPhase[] = [
  {
    id: 'sebana',
    number: 1,
    name: 'SEBaNA',
    year: 'seit 2017',
    tagline: 'Die ärztliche Vorüberlegung',
    description:
      'Strukturierte Anamnese, die Patientendaten maschinell verarbeitbar macht — der konzeptionelle Vorläufer des Twins.',
    icon: 'concept',
  },
  {
    id: 'bloody-check',
    number: 2,
    name: 'Bloody Check',
    year: '2024',
    tagline: 'Die Datengrundlage',
    description:
      'Standardisierte Blutprofile als objektive Datenbasis — verständliche Check-ups, deren Werte direkt in den Twin fließen.',
    icon: 'bloodtest',
  },
  {
    id: 'health-graph',
    number: 3,
    name: 'Health Graph',
    year: '2026',
    tagline: 'Das Wissensmodell',
    description:
      'Ein medizinisches Wissensnetz aus Organen, Laborwerten und Erkrankungen — die kognitive Karte unter dem Twin.',
    icon: 'graph',
  },
  {
    id: 'juvantis',
    number: 4,
    name: 'Juvantis & LifeLinker',
    year: '2026',
    tagline: 'Der digitale Zwilling',
    description:
      'Der DHT als 3D-Avatar auf Web und iOS — mit echter HealthKit-Anbindung, live auf dem Gerät und in Echtzeit reaktiv.',
    icon: 'avatar',
  },
  {
    id: 'health-llm',
    number: 5,
    name: 'Eigenes Health-LLM',
    year: '2026 · live',
    tagline: 'Der medizinische Verstand',
    description:
      'Ein eigenes, on-prem laufendes Health-LLM, das den Verlauf versteht und erklärt — DSGVO-konform, proprietär.',
    icon: 'brain',
  },
];
