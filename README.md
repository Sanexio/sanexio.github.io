# sanexio.github.io

Öffentliche Konzeptseite der **Sanexio GmbH**. Cortex ist unser KI-Framework und unsere Produktplattform, Nexus unsere eigene KI-Engine. Der Digital Health Twin ist ein Produkt dieser Palette.

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

## Inhalte pflegen

Die öffentliche Seite nutzt redaktionell gepflegte Daten unter `src/data/`.
`dev-status.ts` enthält die geplante Cortex-Produktpalette. Der frühere
Release-Feed-Import ist stillgelegt und beendet sich ohne Schreibzugriff.
Die Roadmap enthält geplante Schritte, keine bestätigten Freigaben.

Der Investoren-Pitch wird separat unter `public/investoren/` gepflegt.
Die öffentliche Seite verlinkt `/investoren/`; der Zugangsschutz muss dort
bereitgestellt und vor Veröffentlichung geprüft werden.

## Deployment

GitHub Action `.github/workflows/deploy.yml` runs on every push to `main`:
build → push `dist/` to the `gh-pages` branch. GitHub Pages serves from
that branch.

## Cortex-Distribution auf gh-pages

Der Branch `gh-pages` enthält neben der Astro-Site den manuell publizierten
`cortex/`-Distributions-Baum. Diese Artefakte kommen nicht aus dem Astro-Build:
sie enthalten Update-Manifeste, signierte und notarisierte Tarballs, Docs und
`install.sh`. Deshalb nutzt der Pages-Deploy `keep_files: true`; ohne diese
Einstellung würde jeder Deploy aus `dist/` den `cortex/`-Baum löschen.

Publizieren:

```bash
bash tools/publish-cortex.sh --from-ref <ref>
bash tools/publish-cortex.sh --source <dir-mit-cortex-baum>
```

Vor dem Commit validiert der Publisher die JSON-Manifeste und die SHA-256-Werte
der referenzierten Tarballs. Mit `--dry-run` werden Dateiliste und Validierung
angezeigt, ohne nach `gh-pages` zu committen oder zu pushen.

Vertraglich stabile URLs:

- `https://sanexio.github.io/cortex/api/v1/update/manifest.json`
- `https://sanexio.github.io/cortex/nexus/api/v1/update/manifest.json`
- `https://sanexio.github.io/cortex/dist/<tarball>`
- `https://sanexio.github.io/cortex/docs/`

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

## Gestaltung

„Praxis 2025“: heller Hintergrund, weiße Karten mit 18px Radius, rote Akzente
und lokal geladene Inter/Inter Tight. Primitive und semantische Zuordnungen
liegen ausschließlich in `src/styles/tokens.css`. Komponenten verwenden
semantische Tokens. Der helle Modus gilt auch für die Rechtsseiten.

`/health-graph.html` führt zum aktuellen Twin-Konzept auf der Startseite.
Die frühere isolierte Demo wird nicht mehr öffentlich ausgeliefert.

## License

Content: © Sanexio GmbH. Code: see LICENSE (TBD).
