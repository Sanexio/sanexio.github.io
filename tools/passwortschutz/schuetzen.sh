#!/usr/bin/env bash
# Passwortschutz fuer die ausgelieferte Seite (StatiCrypt, AES-256 im Browser).
#
# Aufruf:  STATICRYPT_PASSWORD=... tools/passwortschutz/schuetzen.sh [dist] [git-ref-der-auslieferung]
#
# - Verschluesselt JEDE .html-Datei unter <dist> an Ort und Stelle.
# - Offen bleiben nur die Pflichtseiten in OFFEN (Impressum, Datenschutz).
# - Ist ein Git-Ref der bisherigen Auslieferung angegeben (z. B. FETCH_HEAD von
#   gh-pages), werden dort liegende, noch UNverschluesselte Seiten, die der Bau
#   nicht selbst erzeugt (Altseiten, DHT-Vorschauen), nach <dist> geholt und
#   mitverschluesselt. Der Deploy behaelt alte Dateien (keep_files) - ohne
#   diesen Schritt blieben sie offen im Netz.
# - Nie angefasst: AUSGENOMMEN (App-Auslieferung unter cortex/).
# - Fehlt das Passwort, bricht das Skript ab: lieber kein Deploy als ein offener.
#
# Grenze: geschuetzt sind die HTML-Seiten. Bilder, Videos, Schriften, Skripte
# und Modelle bleiben ueber ihre direkte Adresse abrufbar.
set -euo pipefail

DIST="${1:-dist}"
ALTREF="${2:-}"
HIER="$(cd "$(dirname "$0")" && pwd)"
VERSION="3.5.4"
OFFEN=("impressum/index.html" "datenschutz/index.html")
AUSGENOMMEN='^cortex/'

if [ -z "${STATICRYPT_PASSWORD:-}" ]; then
    echo "FEHLER: STATICRYPT_PASSWORD ist nicht gesetzt - Abbruch, es wird nichts ungeschuetzt ausgeliefert." >&2
    exit 1
fi
[ -d "$DIST" ] || { echo "FEHLER: Ordner $DIST fehlt." >&2; exit 1; }

# 1. Unverschluesselte Altseiten aus der bisherigen Auslieferung dazuholen
geholt=0
if [ -n "$ALTREF" ]; then
    while IFS= read -r -d '' pfad; do
        case "$pfad" in *.html) ;; *) continue ;; esac
        if printf '%s' "$pfad" | grep -Eq "$AUSGENOMMEN"; then continue; fi
        [ -e "$DIST/$pfad" ] && continue
        ueberspringen=0
        for o in "${OFFEN[@]}"; do [ "$pfad" = "$o" ] && ueberspringen=1; done
        [ "$ueberspringen" = 1 ] && continue
        if git show "$ALTREF:$pfad" | grep -q 'staticryptInitiator'; then continue; fi
        mkdir -p "$DIST/$(dirname "$pfad")"
        git show "$ALTREF:$pfad" > "$DIST/$pfad"
        geholt=$((geholt + 1))
    done < <(git ls-tree -r -z --name-only "$ALTREF")
fi
echo "Altseiten dazugeholt: $geholt"

# Fester Salzwert: damit ein gemerktes Passwort ueber Deploys hinweg gilt
SALZ="$(sed -n 's/.*"salt": *"\([0-9a-f]\{32\}\)".*/\1/p' "$HIER/staticrypt.json")"
[ -n "$SALZ" ] || { echo "FEHLER: Salzwert in staticrypt.json fehlt." >&2; exit 1; }

# 2. Pflichtseiten beiseitelegen (kommen auch bei Abbruch zurueck)
ABLAGE="$(mktemp -d)"
zuruecklegen() {
    for o in "${OFFEN[@]}"; do
        if [ -f "$ABLAGE/$o" ]; then mv "$ABLAGE/$o" "$DIST/$o"; fi
    done
}
trap zuruecklegen EXIT
for o in "${OFFEN[@]}"; do
    if [ -f "$DIST/$o" ]; then
        mkdir -p "$ABLAGE/$(dirname "$o")"
        mv "$DIST/$o" "$ABLAGE/$o"
    fi
done

# 3. Alles Uebrige verschluesseln (an Ort und Stelle)
npx --yes "staticrypt@$VERSION" "$DIST"/* -r -d "$DIST" \
    -c false -s "$SALZ" \
    -t "$HIER/vorlage.html" \
    --short \
    --remember 30 \
    --template-title "Geschützter Bereich" \
    --template-instructions "Diese Seite ist nicht öffentlich. Bitte geben Sie das Passwort ein." \
    --template-placeholder "Passwort" \
    --template-button "Öffnen" \
    --template-error "Das Passwort stimmt nicht." \
    --template-remember "Angemeldet bleiben" \
    --template-toggle-show "Passwort anzeigen" \
    --template-toggle-hide "Passwort verbergen" \
    --template-color-primary "#C8161D" \
    --template-color-secondary "#F5F5F7"

# 4. Pflichtseiten zuruecklegen
zuruecklegen

# 5. Pruefen: keine HTML-Datei ausser den Pflichtseiten darf offen sein
offen=0
while IFS= read -r -d '' f; do
    rel="${f#"$DIST"/}"
    erlaubt=0
    for o in "${OFFEN[@]}"; do [ "$rel" = "$o" ] && erlaubt=1; done
    [ "$erlaubt" = 1 ] && continue
    if ! grep -q 'staticryptInitiator' "$f"; then
        echo "OFFEN GEBLIEBEN: $rel" >&2
        offen=$((offen + 1))
    fi
done < <(find "$DIST" -name '*.html' -print0)
if [ "$offen" -gt 0 ]; then
    echo "FEHLER: $offen Seite(n) unverschluesselt - Abbruch." >&2
    exit 1
fi
echo "Passwortschutz: $(find "$DIST" -name '*.html' | wc -l | tr -d ' ') HTML-Dateien, davon ${#OFFEN[@]} bewusst offen."
