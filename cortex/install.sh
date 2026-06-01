#!/usr/bin/env bash
# ============================================================
# install.sh — Cortex-Plattform Bootstrap (Welle 3.6 Stub)
# ============================================================
# Erst-Installation auf einem neuen Mac:
#   curl -fsSL https://cortex.sanexio.de/install.sh | sh
#
# Aktueller Stand (Welle 3.6 Stub): das Skript prüft Voraussetzungen
# (Bun + macOS), lädt heute NICHT herunter (Distribution-URL noch
# nicht live), sondern verweist auf manuellen git-clone-Pfad.
# Welle-3.6-Final ersetzt den Manual-Pfad durch ein Bundle-Download
# vom cortex.sanexio.de-Endpoint.
# ============================================================

set -euo pipefail

CORTEX_CLI_REPO="${CORTEX_CLI_REPO:-git@github.com:Sanexio/cortex-cli.git}"
CORTEX_BIN_TARGET="${CORTEX_BIN_TARGET:-$HOME/bin/cortex}"
CORTEX_INSTALL_MODE="${CORTEX_INSTALL_MODE:-dev}"  # dev | bundle

# ---------- Helpers ----------

log()  { printf "[install.sh] %s\n" "$*"; }
warn() { printf "[install.sh] WARN: %s\n" "$*" >&2; }
die()  { printf "[install.sh] FEHLER: %s\n" "$*" >&2; exit 1; }

need() {
  command -v "$1" >/dev/null 2>&1 || die "'$1' fehlt — bitte installieren (z.B. via Homebrew)."
}

# ---------- Plattform-Check ----------

if [ "$(uname)" != "Darwin" ]; then
  die "Cortex-Plattform unterstützt heute nur macOS. Linux/Windows: später."
fi

log "Plattform-Check: macOS $(sw_vers -productVersion) ($(uname -m))"

# ---------- Bun-Check ----------

if ! command -v bun >/dev/null 2>&1; then
  log "Bun nicht gefunden — installiere via Homebrew …"
  if command -v brew >/dev/null 2>&1; then
    brew install oven-sh/bun/bun
  else
    die "Homebrew fehlt. Bitte erst installieren: https://brew.sh"
  fi
fi

log "Bun-Version: $(bun --version)"

# ---------- Install-Modus ----------

case "$CORTEX_INSTALL_MODE" in
  dev)
    log "Modus: dev (Git-Clone von ${CORTEX_CLI_REPO})"
    need git
    INSTALL_DIR="${HOME}/Cortex/projects/cortex-cli"
    if [ -d "$INSTALL_DIR" ]; then
      log "cortex-cli existiert bereits unter ${INSTALL_DIR} — überspringe Clone."
    else
      mkdir -p "$(dirname "$INSTALL_DIR")"
      git clone --depth 1 "$CORTEX_CLI_REPO" "$INSTALL_DIR"
    fi

    mkdir -p "$(dirname "$CORTEX_BIN_TARGET")"
    if [ ! -L "$CORTEX_BIN_TARGET" ] && [ ! -e "$CORTEX_BIN_TARGET" ]; then
      cat > "$CORTEX_BIN_TARGET" <<EOF
#!/usr/bin/env bash
exec bun "${INSTALL_DIR}/bin/cortex.mjs" "\$@"
EOF
      chmod +x "$CORTEX_BIN_TARGET"
      log "Wrapper-Skript geschrieben: ${CORTEX_BIN_TARGET}"
    else
      log "${CORTEX_BIN_TARGET} existiert bereits — überspringe."
    fi
    ;;

  bundle)
    # Welle 3.6d: Download signiertes + notarisiertes Bundle vom
    # cortex.sanexio.de-Manifest-Endpoint, sha256-Verify, Extract.
    #
    # Pfad:
    #   1. GET https://sanexio.github.io/cortex/api/v1/update/manifest.json → JSON
    #   2. Asset für aktuelles Mac-Target (arch) auswählen
    #   3. Download Tarball + sha256-Verify gegen Manifest-Hash
    #   4. Extract nach $INSTALL_DIR (default ~/.cortex/cli)
    #   5. Bin-Wrapper auf $CORTEX_BIN_TARGET zeigen lassen
    need curl
    need shasum
    need tar

    local arch
    arch="$(uname -m)"
    case "$arch" in
      arm64)  arch_key="darwin-arm64" ;;
      x86_64) arch_key="darwin-x64"   ;;
      *)      die "Unbekannte Architektur: $arch" ;;
    esac

    local manifest_url="${CORTEX_MANIFEST_URL:-https://sanexio.github.io/cortex/api/v1/update/manifest.json}"
    log "Hole Manifest: $manifest_url"
    local manifest
    if ! manifest="$(curl -fsSL "$manifest_url")"; then
      die "Manifest-Download fehlgeschlagen ($manifest_url)"
    fi

    # JSON-Parse ohne jq-Dependency (BSD-grep + sed liegt überall).
    # Schema-Erwartung:
    #   { "version": "...", "assets": { "darwin-x64": { "url": "...", "sha256": "..." }, ... } }
    local version asset_url asset_sha
    version="$(printf "%s" "$manifest" | grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')"
    asset_url="$(printf "%s" "$manifest" | grep -A2 "\"${arch_key}\"" | grep -o '"url"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')"
    asset_sha="$(printf "%s" "$manifest" | grep -A3 "\"${arch_key}\"" | grep -o '"sha256"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')"

    [ -n "$version" ]   || die "Manifest ohne 'version'-Feld"
    [ -n "$asset_url" ] || die "Manifest hat kein Asset für $arch_key"
    [ -n "$asset_sha" ] || die "Manifest ohne sha256 für $arch_key"

    log "Distribution: cortex-cli $version ($arch_key)"

    local install_dir="${CORTEX_INSTALL_DIR:-$HOME/.cortex/cli}"
    mkdir -p "$install_dir"
    local tmp_tgz
    tmp_tgz="$(mktemp -t cortex-cli-bundle.XXXXXX).tar.gz"

    log "Lade $asset_url …"
    if ! curl -fsSL -o "$tmp_tgz" "$asset_url"; then
      rm -f "$tmp_tgz"
      die "Bundle-Download fehlgeschlagen ($asset_url)"
    fi

    # sha256-Verify — schützt vor MITM + corrupted Download.
    local local_sha
    local_sha="$(shasum -a 256 "$tmp_tgz" | awk '{print $1}')"
    if [ "$local_sha" != "$asset_sha" ]; then
      rm -f "$tmp_tgz"
      die "sha256-Mismatch! Expected $asset_sha, got $local_sha"
    fi
    log "sha256 verified ($local_sha)"

    # Extract — Tarball-Inhalt: cortex-darwin-<arch> Binary + ggf. README.
    tar -xzf "$tmp_tgz" -C "$install_dir"
    rm -f "$tmp_tgz"

    # Binary umbenennen auf 'cortex' für stabilen Pfad.
    local extracted_bin="$install_dir/cortex-${arch_key}"
    [ -x "$extracted_bin" ] || die "Erwartetes Binary nicht im Tarball: $extracted_bin"
    ln -sf "$extracted_bin" "$install_dir/cortex"

    # Bin-Wrapper auf das Binary zeigen.
    mkdir -p "$(dirname "$CORTEX_BIN_TARGET")"
    ln -sf "$install_dir/cortex" "$CORTEX_BIN_TARGET"
    log "Wrapper-Symlink: ${CORTEX_BIN_TARGET} → ${install_dir}/cortex"
    ;;

  *)
    die "Unbekannter Install-Modus: ${CORTEX_INSTALL_MODE}"
    ;;
esac

# ---------- ~/.cortex/-Bootstrap via cortex install ----------

log "Lege ~/.cortex/-Struktur an …"
"$CORTEX_BIN_TARGET" install

# ---------- Welle 3.6f: LaunchAgent-Auto-Install ----------

install_launchagent() {
  local label="de.sanexio.cortex-update-check"
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  local template="${script_dir}/${label}.plist.template"
  local target_dir="${HOME}/Library/LaunchAgents"
  local target_plist="${target_dir}/${label}.plist"

  if [ ! -f "$template" ]; then
    # install.sh kann via 'curl|sh' ohne lokales Repo laufen — Template
    # nicht vorhanden ist OK, dann skippen mit Hinweis.
    warn "LaunchAgent-Template fehlt: $template — skip (Update-Check muss manuell laufen)"
    return 0
  fi

  mkdir -p "$target_dir"
  mkdir -p "${HOME}/.cortex/state"

  # Template-Substitution: __CORTEX_BIN__ + __USER_HOME__.
  # sed mit '|' als Delim, weil Pfade Slashes enthalten.
  sed \
    -e "s|__CORTEX_BIN__|${CORTEX_BIN_TARGET}|g" \
    -e "s|__USER_HOME__|${HOME}|g" \
    "$template" > "$target_plist"

  log "LaunchAgent-Plist geschrieben: $target_plist"

  # Idempotenz: wenn schon geladen, erst bootout (sonst bootstrap-fail).
  # gui/$UID ist die User-Session; launchctl print zeigt Status.
  if launchctl print "gui/$UID/${label}" >/dev/null 2>&1; then
    log "LaunchAgent ${label} bereits geladen — bootout + reload."
    launchctl bootout "gui/$UID" "$target_plist" 2>/dev/null || true
  fi

  if launchctl bootstrap "gui/$UID" "$target_plist" 2>/dev/null; then
    log "LaunchAgent ${label} geladen (bootstrap gui/$UID)."
  else
    # Fallback: legacy 'launchctl load -w' fuer alte macOS-Versionen.
    if launchctl load -w "$target_plist" 2>/dev/null; then
      log "LaunchAgent ${label} via legacy load -w geladen."
    else
      warn "launchctl bootstrap + legacy load fehlgeschlagen — LaunchAgent NICHT aktiv."
      warn "Manuell laden: launchctl bootstrap gui/\$UID $target_plist"
      return 1
    fi
  fi

  # Verify: launchctl print zeigt Job-Status.
  if launchctl print "gui/$UID/${label}" >/dev/null 2>&1; then
    log "LaunchAgent verify OK."
  else
    warn "LaunchAgent geladen, aber 'launchctl print' findet ihn nicht — manuell pruefen."
  fi
}

log "Installiere LaunchAgent fuer taeglichen Update-Check (Welle 3.6f) …"
install_launchagent || warn "LaunchAgent-Install nicht-blockierend fehlgeschlagen."

# ---------- Pfad-Hinweis ----------

case ":$PATH:" in
  *":$(dirname "$CORTEX_BIN_TARGET"):"*) ;;
  *)
    warn "$(dirname "$CORTEX_BIN_TARGET") ist nicht in \$PATH — füge das zu deiner ~/.zshrc hinzu:"
    printf '  export PATH="$HOME/bin:$PATH"\n' >&2
    ;;
esac

log "Installation abgeschlossen."
log "Nächster Schritt: cortex init --license XXXX-YYYY-ZZZZ"
