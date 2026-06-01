#!/usr/bin/env bash
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: npm run release:serve -- <patch|minor|major>"
  exit 1
fi

BUMP="$1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVE="$ROOT/serve"

DIRTY="$(git status --porcelain)"
if [ -n "$DIRTY" ]; then
  echo "Working tree is not clean. Commit or stash changes first."
  exit 1
fi

echo "Running CI checks..."
npm run typecheck --workspace=serve
npm run test --workspace=serve
npm run build --workspace=serve

echo "Bumping version ($BUMP)..."
cd "$SERVE"
node scripts/bump-version.cjs "$BUMP"
NEW_VERSION="$(node -p "require('./package.json').version")"
TAG="serve-v${NEW_VERSION}"

cd "$ROOT"
git add serve/package.json
git commit -m "release(serve): v${NEW_VERSION}"
git tag "$TAG"

echo "Pushing commit + tag..."
git push
git push origin "$TAG"

echo ""
echo "Released serve v${NEW_VERSION}"
echo "https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/actions"
