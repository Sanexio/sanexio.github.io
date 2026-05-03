// News teasers — three static stubs that point to sanexio.de/blog.
// Replace with live RSS pull in a future iteration if cadence justifies it.

export interface NewsItem {
  id: string;
  title: string;
  excerpt: string;
  date: string; // ISO 8601 (YYYY-MM-DD)
  href: string;
}

export const newsItems: NewsItem[] = [
  {
    id: 'health-graph-launch',
    title: 'Health Graph: Wissensmodell als interaktive Demo',
    excerpt:
      'Der medizinische Knowledge Graph ist online. Drei Knotentypen, drei Kantenarten, eine Karte — die kognitive Grundlage des Digital Health Twin.',
    date: '2026-04',
    href: 'https://sanexio.de/blog',
  },
  {
    id: 'bloody-check',
    title: 'Bloody Check: standardisierte Blutprofile',
    excerpt:
      'Verständliche Check-ups als Basis des DHT — die Daten kommen direkt in den Graph und in den Zwilling.',
    date: '2024',
    href: 'https://sanexio.eu',
  },
  {
    id: 'praxis-partner',
    title: 'Klinische Validierung in der Partnerpraxis',
    excerpt:
      'Warum jede Sanexio-Methode den Realitätscheck in der Praxis Dr. Stracke & Kollegen durchläuft.',
    date: '2026-03',
    href: 'https://sanexio.de/blog',
  },
];
