#!/usr/bin/env bash
# Passwortschutz fuer die ausgelieferte Seite (StatiCrypt, AES-256 im Browser).
#
# Aufruf:  STATICRYPT_PASSWORD=... tools/passwortschutz/schuetzen.sh [dist] [git-ref-der-auslieferung]
#
# - Entscheid Dr. Stracke, 28.11.2026: „geschützt werden soll eigentlich nur der Business-Case Bereich - der rest soll
#   öffentlich einsehbar sein“.
# - Nur HTML unter business-case/ wird verschluesselt; alle anderen Seiten sind oeffentlich.
# - Altseiten aus ALTREF: geschuetzte Seiten auf eine Schicht bringen,
#   oeffentliche Seiten vollstaendig entschluesseln.
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
GESCHUETZT='^business-case/'
AUSGENOMMEN='^cortex/'

if [ -z "${STATICRYPT_PASSWORD:-}" ]; then
    echo "FEHLER: STATICRYPT_PASSWORD ist nicht gesetzt - Abbruch, es wird nichts ungeschuetzt ausgeliefert." >&2
    exit 1
fi
[ -d "$DIST" ] || { echo "FEHLER: Ordner $DIST fehlt." >&2; exit 1; }

# Fester Salzwert: damit ein gemerktes Passwort ueber Deploys hinweg gilt
SALZ="$(sed -n 's/.*"salt": *"\([0-9a-f]\{32\}\)".*/\1/p' "$HIER/staticrypt.json")"
[ -n "$SALZ" ] || { echo "FEHLER: Salzwert in staticrypt.json fehlt." >&2; exit 1; }

# 1. Altseiten aus der bisherigen Auslieferung pruefen und bei Bedarf dazuholen.
#    Jede Seite wird in eine Datei geholt und dort geprueft - NICHT ueber eine
#    Pipe mit grep -q: unter pipefail bricht das bei grossen Dateien ab (SIGPIPE)
#    und die Seite galt faelschlich als unverschluesselt. Folge am 26.11.2026:
#    health-graph.html wurde bei jedem Deploy erneut verschluesselt (7 Schichten,
#    Groesse jedes Mal verdoppelt) bis GitHubs 100-MB-Grenze den Deploy stoppte.
#    Geschuetzt: genau 1 Schicht bleibt bestehen; sonst unten einmal verschluesseln.
#    Oeffentlich: alle vorhandenen Schichten entfernen; Klartext bleibt bestehen.
geholt=0; geheilt=0; geoeffnet=0; unlesbar=0
if [ -n "$ALTREF" ]; then
    PRUEF="$(mktemp -d)"
    while IFS= read -r -d '' pfad; do
        case "$pfad" in *.html) ;; *) continue ;; esac
        if printf '%s' "$pfad" | grep -Eq "$AUSGENOMMEN"; then continue; fi
        [ -e "$DIST/$pfad" ] && continue
        git cat-file -p "$ALTREF:$pfad" > "$PRUEF/seite.html"
        schichten=0
        while grep -q 'staticryptInitiator' "$PRUEF/seite.html"; do
            rm -rf "$PRUEF/aus"
            if [ "$schichten" -ge 12 ] || ! (cd "$PRUEF" && npx --yes "staticrypt@$VERSION" seite.html --decrypt -d aus -c false -s "$SALZ" > /dev/null 2>&1) || [ ! -s "$PRUEF/aus/seite.html" ]; then
                schichten=-1; break
            fi
            mv "$PRUEF/aus/seite.html" "$PRUEF/seite.html"
            schichten=$((schichten + 1))
        done
        if [ "$schichten" = -1 ]; then
            echo "WARNUNG: $pfad laesst sich nicht entschluesseln (anderes Passwort?) - bleibt unveraendert." >&2
            unlesbar=$((unlesbar + 1)); continue
        fi
        if [[ "$pfad" =~ $GESCHUETZT ]]; then
            [ "$schichten" = 1 ] && continue
        else
            [ "$schichten" = 0 ] && continue
        fi
        mkdir -p "$DIST/$(dirname "$pfad")"
        cp "$PRUEF/seite.html" "$DIST/$pfad"
        if [ "$schichten" = 0 ]; then geholt=$((geholt + 1))
        elif [[ "$pfad" =~ $GESCHUETZT ]]; then geheilt=$((geheilt + 1)); echo "Geheilt ($schichten Schichten): $pfad"
        else geoeffnet=$((geoeffnet + 1)); echo "Geoeffnet (oeffentlich, $schichten Schicht(en) entfernt): $pfad"; fi
    done < <(git ls-tree -r -z --name-only "$ALTREF")
    rm -rf "$PRUEF"
fi
echo "Altseiten: $geholt unverschluesselt dazugeholt, $geheilt geschuetzte geheilt, $geoeffnet oeffentliche entschluesselt, $unlesbar nicht lesbar"

# 3. Nur den Business Case verschluesseln (an Ort und Stelle)
[ -d "$DIST/business-case" ] || { echo "FEHLER: Ordner $DIST/business-case fehlt." >&2; exit 1; }
npx --yes "staticrypt@$VERSION" "$DIST/business-case" -r -d "$DIST" \
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

# 5. Schutzgrenze fuer jede HTML-Datei pruefen (cortex/ bleibt unangetastet).
geschuetzt=0; oeffentlich=0; fehler=0
while IFS= read -r -d '' f; do
    rel="${f#"$DIST"/}"
    [[ "$rel" =~ $AUSGENOMMEN ]] && continue
    if [[ "$rel" =~ $GESCHUETZT ]]; then
        geschuetzt=$((geschuetzt + 1))
        if ! grep -q 'staticryptInitiator' "$f"; then
            echo "OFFEN GEBLIEBEN: $rel" >&2
            fehler=$((fehler + 1))
        fi
    else
        oeffentlich=$((oeffentlich + 1))
        if grep -q 'staticryptInitiator' "$f"; then
            echo "UNERWARTET GESCHUETZT: $rel" >&2
            fehler=$((fehler + 1))
        fi
    fi
done < <(find "$DIST" -name '*.html' -print0)
if [ "$fehler" -gt 0 ]; then
    echo "FEHLER: $fehler Seite(n) mit falschem Schutzstatus - Abbruch." >&2
    exit 1
fi
echo "Passwortschutz: $geschuetzt geschützt, $oeffentlich öffentlich"
