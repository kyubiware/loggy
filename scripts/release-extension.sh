#!/usr/bin/env bash
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: npm run release:extension -- <patch|minor|major>"
  exit 1
fi

BUMP="$1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXTENSION="$ROOT/extension"

DIRTY="$(git status --porcelain)"
if [ -n "$DIRTY" ]; then
  echo "Working tree is not clean. Commit or stash changes first."
  exit 1
fi

echo "Running CI checks..."
npm run lint --workspace=extension
npm run typecheck --workspace=extension
npm run test:run --workspace=extension

echo "Bumping version ($BUMP)..."
cd "$EXTENSION"
node scripts/bump-version.cjs "$BUMP"
NEW_VERSION="$(node -p "require('./manifest.json').version")"
TAG="v${NEW_VERSION}"

cd "$ROOT"
git add extension/manifest.json extension/manifest-chrome.json extension/manifest-firefox.json extension/package.json
git commit -m "release(extension): v${NEW_VERSION}"
git tag "$TAG"

echo "Pushing commit + tag..."
git push
git push origin "$TAG"

echo ""
echo "Released extension v${NEW_VERSION}"
echo "https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/actions"
