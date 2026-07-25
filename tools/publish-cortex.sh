#!/usr/bin/env bash
set -euo pipefail

DEFAULT_REF="83469ec27224656ea697ad84f57da43601f2c500"

usage() {
  cat <<'EOF'
Usage:
  bash tools/publish-cortex.sh [--from-ref <git-ref>] [--source <dir>] [--dry-run]

Publishes the cortex/ distribution tree to origin/gh-pages.

Options:
  --from-ref <git-ref>  Extract cortex/** from the given ref.
  --source <dir>        Use a directory that contains a cortex/ tree.
  --dry-run             List files and validate only; do not commit or push.
  -h, --help            Show this help.
EOF
}

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

repo_root() {
  git rev-parse --show-toplevel
}

json_validate() {
  local manifest="$1"
  if command -v jq >/dev/null 2>&1; then
    jq empty "$manifest" >/dev/null
  else
    python3 -m json.tool "$manifest" >/dev/null
  fi
}

prepare_source_from_ref() {
  local ref="$1"
  local dest="$2"

  git cat-file -e "${ref}:cortex" 2>/dev/null || die "ref '$ref' does not contain cortex/"
  git archive "$ref" cortex | tar -x -C "$dest"
}

prepare_source_from_dir() {
  local source_dir="$1"
  local dest="$2"

  [[ -d "$source_dir/cortex" ]] || die "--source must point to a directory containing cortex/"
  mkdir -p "$dest/cortex"
  rsync -a "$source_dir/cortex/" "$dest/cortex/"
}

validate_tree() {
  local root="$1"
  local manifests=(
    "$root/cortex/api/v1/update/manifest.json"
    "$root/cortex/nexus/api/v1/update/manifest.json"
  )

  for manifest in "${manifests[@]}"; do
    [[ -f "$manifest" ]] || die "missing manifest: ${manifest#$root/}"
    json_validate "$manifest"
  done

  python3 - "$root" "${manifests[@]}" <<'PY'
import hashlib
import json
import sys
from pathlib import Path
from urllib.parse import urlparse

root = Path(sys.argv[1])
errors = []
checked = 0

for manifest_arg in sys.argv[2:]:
    manifest = Path(manifest_arg)
    data = json.loads(manifest.read_text(encoding="utf-8"))
    assets = data.get("assets")
    if not isinstance(assets, dict):
        errors.append(f"{manifest.relative_to(root)}: missing assets object")
        continue

    manifest_dir = manifest.parent
    for asset_name, asset in assets.items():
        if not isinstance(asset, dict):
            errors.append(f"{manifest.relative_to(root)}: asset {asset_name!r} is not an object")
            continue
        url = asset.get("url")
        expected_sha = asset.get("sha256")
        if not isinstance(url, str) or not url:
            errors.append(f"{manifest.relative_to(root)}: asset {asset_name!r} has no url")
            continue
        if not isinstance(expected_sha, str) or not expected_sha:
            errors.append(f"{manifest.relative_to(root)}: asset {asset_name!r} has no sha256")
            continue

        basename = Path(urlparse(url).path).name
        candidates = [
            root / "cortex" / "dist" / basename,
            root / "cortex" / "nexus" / "dist" / basename,
            manifest_dir.parent.parent.parent / "dist" / basename,
        ]
        tarball = next((path for path in candidates if path.is_file()), None)
        if tarball is None:
            errors.append(f"{manifest.relative_to(root)}: missing tarball for {asset_name!r}: {basename}")
            continue

        actual_sha = hashlib.sha256(tarball.read_bytes()).hexdigest()
        if actual_sha != expected_sha:
            errors.append(
                f"{tarball.relative_to(root)}: sha256 mismatch "
                f"(expected {expected_sha}, got {actual_sha})"
            )
            continue
        checked += 1

if errors:
    for error in errors:
        print(f"validation error: {error}", file=sys.stderr)
    sys.exit(1)

print(f"Validation OK: {len(sys.argv) - 2} manifests parsed, {checked} tarballs verified")
PY
}

list_cortex_files() {
  local root="$1"
  find "$root/cortex" -type f -print | sed "s#^$root/##" | LC_ALL=C sort
}

copy_cortex_tree() {
  local source_root="$1"
  local worktree="$2"

  mkdir -p "$worktree/cortex"
  rsync -a "$source_root/cortex/" "$worktree/cortex/"
}

push_with_retry() {
  local worktree="$1"

  if git -C "$worktree" push origin HEAD:gh-pages; then
    return 0
  fi

  printf 'Push rejected; rebasing on origin/gh-pages and retrying once...\n' >&2
  git -C "$worktree" pull --rebase origin gh-pages
  git -C "$worktree" push origin HEAD:gh-pages
}

source_dir=""
from_ref="$DEFAULT_REF"
from_ref_set=0
dry_run=0
source_label=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source)
      [[ $# -ge 2 ]] || die "--source requires a directory"
      source_dir="$2"
      source_label="source:$2"
      shift 2
      ;;
    --from-ref)
      [[ $# -ge 2 ]] || die "--from-ref requires a git ref"
      from_ref="$2"
      from_ref_set=1
      source_label="ref:$2"
      shift 2
      ;;
    --dry-run)
      dry_run=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "unknown argument: $1"
      ;;
  esac
done

[[ -z "$source_dir" || "$from_ref_set" -eq 0 ]] || die "use either --source or --from-ref, not both"
[[ -n "$source_label" ]] || source_label="ref:$from_ref"

REPO_ROOT="$(repo_root)"
tmp_root="$(mktemp -d "${TMPDIR:-/tmp}/publish-cortex.XXXXXX")"
source_root="$tmp_root/source"
worktree=""

cleanup() {
  if [[ -n "$worktree" && -e "$worktree/.git" ]]; then
    git -C "$REPO_ROOT" worktree remove --force "$worktree" >/dev/null 2>&1 || true
  fi
  rm -rf "$tmp_root"
}
trap cleanup EXIT

mkdir -p "$source_root"

if [[ -n "$source_dir" ]]; then
  prepare_source_from_dir "$source_dir" "$source_root"
else
  prepare_source_from_ref "$from_ref" "$source_root"
fi

file_count="$(list_cortex_files "$source_root" | wc -l | tr -d ' ')"
printf 'Cortex files (%s):\n' "$file_count"
list_cortex_files "$source_root"
validate_tree "$source_root"

if [[ "$dry_run" -eq 1 ]]; then
  printf 'Dry run: no commit or push performed.\n'
  exit 0
fi

git -C "$REPO_ROOT" fetch origin gh-pages
worktree="$(mktemp -d "${TMPDIR:-/tmp}/cortex-gh-pages.XXXXXX")"
rmdir "$worktree"
git -C "$REPO_ROOT" worktree add "$worktree" origin/gh-pages

copy_cortex_tree "$source_root" "$worktree"
validate_tree "$worktree"

# add VOR dem Diff-Check: 'git diff --quiet' sieht untracked Files nicht —
# im Erstpublish-Fall (kein cortex/ auf gh-pages) wäre das ein stiller No-Op.
git -C "$worktree" add cortex
if git -C "$worktree" diff --cached --quiet -- cortex; then
  printf 'No cortex/ changes to publish.\n'
  exit 0
fi

git -C "$worktree" commit -m "cortex-dist: publish /cortex Distributions-Baum (${source_label})"
push_with_retry "$worktree"
