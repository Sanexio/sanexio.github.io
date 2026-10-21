// News teasers — DHT blog series on sanexio.github.io.

export interface NewsItem {
  id: string;
  title: string;
  excerpt: string;
  date: string;
  href: string;
  external: boolean;
}

export const newsItems: NewsItem[] = [
  {
    id: 'blog-health-graph',
    title: 'Health Graph: die Engine hinter dem DHT',
    excerpt:
      'Organe, Laborwerte und Wechselwirkungen als Wissensnetz — verknüpft mit den 3D-Stationen der Reise durch den Körper.',
    date: '2026-10-21',
    href: '/blog/health-graph-engine-des-dht/',
    external: false,
  },
  {
    id: 'blog-mitbauen',
    title: 'Mitbauen: Feedback formt den Twin',
    excerpt:
      'Stationen testen, Fragen stellen, Prioritäten mitbestimmen — so wächst der Digital Health Twin mit Nutzerinnen und Nutzern.',
    date: '2026-10-20',
    href: '/blog/mitbauen-wie-nutzer-den-dht-mitgestalten/',
    external: false,
  },
  {
    id: 'blog-werkstatt',
    title: 'Werkstattbericht: 3D-Organe Schritt für Schritt',
    excerpt:
      'Herz, Niere, Leber und die Zoom-Kette — ein gemeinsamer Bestand für Reise und Digital Health Twin.',
    date: '2026-10-16',
    href: '/blog/werkstattbericht-3d-organe-schritt-fuer-schritt/',
    external: false,
  },
  {
    id: 'blog-idee',
    title: 'Der Digital Health Twin — unsere Idee',
    excerpt:
      'Schicht für Schicht im Browser: vom Körpermodell zum Health Graph als künftige Engine des Zwillings.',
    date: '2026-10-10',
    href: '/blog/digital-health-twin-unsere-idee/',
    external: false,
  },
];
