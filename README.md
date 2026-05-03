# sanexio.github.io

Brand-Hub of **Sanexio GmbH** — Digital Health Care Startup focused on
**Human Enhancement** through the Digital Health Twin (DHT).

Live: https://sanexio.github.io

## Stack

- [Astro 5](https://astro.build/) — static-site generator
- [Tailwind CSS 4](https://tailwindcss.com/) — utility-first via Vite plugin
- TypeScript (strict)
- Bun runtime

## Local development

```bash
bun install
bun run dev      # http://localhost:4321
bun run build    # → dist/
bun run preview  # serve dist/ locally
```

## Deployment

GitHub Action `.github/workflows/deploy.yml` runs on every push to `main`:
build → push `dist/` to the `gh-pages` branch. GitHub Pages serves from
that branch.

## Project structure

```
public/             static assets (logos, favicon, health-graph.html)
src/
  styles/           tokens.css + global.css (Tailwind 4 + --sx-* tokens)
  layouts/          base layout
  components/       Astro components
  data/             typed data (DHT phases, mission, news, social)
  pages/            index + impressum + datenschutz
.github/workflows/  CI/CD
```

## Branding & Tokens

Sanexio identity layer lives in `src/styles/tokens.css`, namespace
`--sx-*`. Three colour anchors:

- `#0a2540` Brand-Dark-Blue (Sanexio logo wordmark)
- `#c1121f` Pulse-Red (EKG glyph in logo)
- `#028090 → #02C39A` Teal gradient (Health Graph data viz)

Wordmark uses Georgia serif (brand recognition); body and UI use Inter.

## Connected projects

- **Praxiszentrum Dr. Stracke & Kollegen** — clinical partner
  (`westend-hausarzt.com`)
- **sanexio.eu** — Shopify storefront for Bloody Check products
- **Juvantis DHT** — iOS app + GitHub repo

## License

Content: © Sanexio GmbH. Code: see LICENSE (TBD).
