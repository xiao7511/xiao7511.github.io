#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"
rm -rf dist
mkdir dist
cp -a public/. dist/
if find dist -type f \( -path '*/functions/*' -o -name '*.sql' -o -name '.env*' \) -print -quit | grep -q .; then
  echo 'Refusing to deploy non-static or sensitive files.' >&2
  exit 1
fi
