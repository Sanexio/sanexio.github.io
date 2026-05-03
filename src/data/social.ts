// Social channels — all eight, modernised for a single icon row.
// Order: most active / most relevant first.
// Icon names map to <SocialBar>'s inline-SVG dictionary.

export interface SocialChannel {
  id: string;
  label: string;
  href: string;
  icon: 'github' | 'linkedin' | 'youtube' | 'twitter' | 'facebook' | 'xing' | 'udemy';
  badge?: string; // e.g. "MEDZPOINT" for the second Facebook page
}

export const socialChannels: SocialChannel[] = [
  {
    id: 'github',
    label: 'Sanexio auf GitHub',
    href: 'https://github.com/Sanexio',
    icon: 'github',
  },
  {
    id: 'linkedin',
    label: 'Dr. Stracke auf LinkedIn',
    href: 'https://www.linkedin.com/in/dr-siegbert-stracke-mba',
    icon: 'linkedin',
  },
  {
    id: 'youtube',
    label: 'Sanexio auf YouTube',
    href: 'https://www.youtube.com/channel/UClZVw9sR8jrBmm5r9h-0ecw',
    icon: 'youtube',
  },
  {
    id: 'twitter',
    label: 'Sanexio auf Twitter / X',
    href: 'https://twitter.com/Sanexio',
    icon: 'twitter',
  },
  {
    id: 'facebook-sanexio',
    label: 'Sanexio auf Facebook',
    href: 'https://www.facebook.com/sanexio',
    icon: 'facebook',
  },
  {
    id: 'facebook-medzpoint',
    label: 'Medzpoint auf Facebook',
    href: 'https://www.facebook.com/Medzpoint-1972376032982607/',
    icon: 'facebook',
    badge: 'MEDZPOINT',
  },
  {
    id: 'xing',
    label: 'Dr. Stracke auf XING',
    href: 'https://www.xing.com/profile/Siegbert_Stracke',
    icon: 'xing',
  },
  {
    id: 'udemy',
    label: 'Dr. Stracke auf Udemy',
    href: 'https://www.udemy.com/user/dr-siegbert-stracke',
    icon: 'udemy',
  },
];
