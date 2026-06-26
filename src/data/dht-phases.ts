// DHT Timeline — four chronological phases of the Digital Health Twin
// rendered by DhtTimeline.astro. Order matters: index 0 → 3 = oldest → newest.

export interface DhtPhase {
  id: string;
  number: number;
  name: string;
  year: string;
  tagline: string;
  description: string;
  link: { label: string; href: string; external: boolean };
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
      'Selbständig erfasste Befund-Anamnese — der konzeptionelle Vorläufer des Digital Health Twin. Ein strukturiertes Anamnese-Modell, das Patientendaten so erfasst, dass sie maschinell verarbeitbar werden.',
    link: { label: 'SEBaNA auf GitHub', href: 'https://github.com/Sanexio/SEBaNA', external: true },
    icon: 'concept',
  },
  {
    id: 'bloody-check',
    number: 2,
    name: 'Bloody Check',
    year: '2024',
    tagline: 'Die Datengrundlage',
    description:
      'Standardisierte Blutprofile als objektive Datenbasis des DHT. Verständliche Check-ups und medizinische Diagnostik, vertrieben über die Sanexio-Plattform — die Werte fließen direkt in den Health Graph ein.',
    link: { label: 'Bloody Check auf sanexio.eu', href: 'https://sanexio.eu', external: true },
    icon: 'bloodtest',
  },
  {
    id: 'health-graph',
    number: 3,
    name: 'Health Graph',
    year: '2026',
    tagline: 'Das Wissensmodell',
    description:
      'Ein interaktives medizinisches Wissensnetz: Organe, Laborwerte und Erkrankungen sind als Knoten verbunden. Drei Kantentypen zeigen Produktion, Indikation und Wirkung. Die kognitive Karte unter dem digitalen Zwilling.',
    link: { label: 'Live-Demo erleben', href: '#health-graph', external: false },
    icon: 'graph',
  },
  {
    id: 'juvantis',
    number: 4,
    name: 'Juvantis & LifeLinker',
    year: '2026',
    tagline: 'Der digitale Zwilling',
    description:
      'Der DHT als 3D-Avatar auf Web und iOS — live auf dem iPhone mit echter HealthKit-Anbindung. Der Avatar reagiert in Echtzeit auf Vitalwerte, markiert Anomalien als Cyan-Halo und projiziert den Verlauf: „Jetzt / In 3 Monaten".',
    link: { label: 'Juvantis-App auf GitHub', href: 'https://github.com/Sanexio/juvantis-app', external: true },
    icon: 'avatar',
  },
  {
    id: 'health-llm',
    number: 5,
    name: 'Eigenes Health-LLM',
    year: '2026 · live',
    tagline: 'Der medizinische Verstand',
    description:
      'Der Zwilling bekommt ein Gehirn: ein eigenes, on-prem laufendes Health-LLM, das den longitudinalen Verlauf versteht, erklärt und im Avatar-Chat antwortet. Kein fremder API-Key — DSGVO-konform, mit Guardrails. Das proprietäre Backend von Sanexio.',
    link: { label: 'Unser LLM-Konzept', href: '#llm', external: false },
    icon: 'brain',
  },
];
