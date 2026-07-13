// Roadmap — was als Nächstes kommt, auf dem Weg vom Prototyp zum vorzeigbaren
// Produkt. Rendered by RoadmapBlock.astro. Reihenfolge = geplante Abfolge.
//
// HINWEIS: Öffentliche Pitch-Seite. KEINE internen Details (Infrastruktur,
// Endpunkte, Domains, Repos, interne Codenamen). Beschreibungen bewusst gleich
// lang gehalten, damit die Karten symmetrisch wirken.

export interface RoadmapStep {
  id: string;
  number: number;
  name: string;
  status: string;
  tagline: string;
  description: string;
  icon: 'unify' | 'face' | 'care' | 'launch';
}

export const roadmapSteps: RoadmapStep[] = [
  {
    id: 'one-twin',
    number: 1,
    name: 'Ein Zwilling, überall gleich',
    status: 'als Nächstes',
    tagline: 'Web & iPhone aus einer Quelle',
    description:
      'Derselbe interaktive 3D-Avatar auf der Website und in der iPhone-App — aus einer gemeinsamen Quelle, damit der Zwilling überall identisch aussieht und reagiert.',
    icon: 'unify',
  },
  {
    id: 'photo-twin',
    number: 2,
    name: 'Dein Gesicht als Zwilling',
    status: 'in Arbeit',
    tagline: 'Aus einem einzigen Foto',
    description:
      'Aus einem einzigen Foto entsteht ein persönlicher Avatar mit deinen Zügen — der gesundheitliche Zwilling wird spürbar zu deinem eigenen Gegenüber.',
    icon: 'face',
  },
  {
    id: 'personal-care',
    number: 3,
    name: 'Vorsorge, die zu dir passt',
    status: 'in Arbeit',
    tagline: 'Check-ups im Kontext',
    description:
      'Auf den eigenen Zwilling abgestimmte Vorsorge-Check-ups, direkt in App und Web — verständlich eingeordnet, ohne Diagnose, jederzeit in deiner Hand.',
    icon: 'care',
  },
  {
    id: 'public-launch',
    number: 4,
    name: 'Öffentlicher Start',
    status: 'in Vorbereitung',
    tagline: 'Für alle zugänglich',
    description:
      'LifeLinker für iPhone und Web öffentlich verfügbar — der digitale Gesundheits-Zwilling wird vom Prototyp zum Produkt, das jeder selbst ausprobieren kann.',
    icon: 'launch',
  },
];
