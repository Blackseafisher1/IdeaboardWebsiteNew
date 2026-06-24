#!/usr/bin/env bash
set -euo pipefail

TARGET=""

usage() {
  echo "Usage: $0 [-t|--target DIR]"
  echo "  -t, --target DIR   After fetching, copy docs for current project's deps to DIR"
  echo "  (no options)       Just fetch to ~/.hex/docs/hexpm/ (default)"
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -t|--target)
      TARGET="$2"
      shift 2
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo "Unknown option: $1"
      usage
      ;;
  esac
done

packages=$(mix deps | grep '^\*' | awk '{print $2}')

echo "$packages" | xargs -I{} mix hex.docs fetch {} 2>/dev/null

if [[ -n "$TARGET" ]]; then
  mkdir -p "$TARGET"
  for pkg in $packages; do
    src=~/.hex/docs/hexpm/$pkg
    if [[ -d $src ]]; then
      cp -r "$src" "$TARGET/$pkg" 2>/dev/null && echo "  copied: $pkg" || true
    fi
  done
  echo "Docs copied to: $TARGET"
fi

echo "Done"
