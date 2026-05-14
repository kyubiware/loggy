# SCRIPTS KNOWLEDGE BASE

**Scope:** Release automation and Firefox post-processing

## OVERVIEW
CJS scripts for extension build, Firefox post-processing, AMO publishing, and release orchestration. All run via `package.json` scripts.

## STRUCTURE
```
scripts/
├── release.cjs                   # Interactive release orchestrator
├── bump-version.cjs              # Standalone semver bump across manifests/packages
├── prepare-source-zip.cjs        # Source archive with BUILD_INSTRUCTIONS.md
├── fix-devtools-module.cjs       # Firefox: rebundle devtools/panel as IIFE via esbuild
├── rewrite-firefox-manifest.cjs  # No-op stub (retained for pipeline compat)
├── sanitize-firefox-bundle.cjs   # Firefox: .innerHTML → .textContent in JS bundles
├── fix-content-scripts.cjs       # Firefox: strip import/export from content scripts
├── update-amo-description.cjs    # AMO API: PATCH listing description + changelog
├── upload-amo-screenshots.cjs    # AMO API: hash-based diff, upload/delete screenshots
├── screenshot-firefox.cjs        # Playwright: capture panel screenshots in Firefox
├── amo-description.md            # Source-of-truth AMO listing description
└── update-amo-description.test.ts # Tests for appendChangelog
```

## WHERE TO LOOK

| Task | Script | Notes |
|------|--------|-------|
| Full release | release.cjs | lint → typecheck → test → bump → build → lint → package → sign → publish |
| Version bump | bump-version.cjs | Reads manifest.json, writes to 4 files |
| Source archive | prepare-source-zip.cjs | Excludes build artifacts, adds BUILD_INSTRUCTIONS.md |
| Firefox IIFE fix | fix-devtools-module.cjs | esbuild rebundle of devtools.mjs + main.tsx |
| Firefox bundle sanitize | sanitize-firefox-bundle.cjs | In-place .innerHTML → .textContent |
| Firefox content scripts | fix-content-scripts.cjs | Strip import/export, remove crossorigin attrs |
| AMO description | update-amo-description.cjs | JWT auth, reads amo-description.md |
| AMO screenshots | upload-amo-screenshots.cjs | Hash-based diff against AMO previews |
| Screenshot capture | screenshot-firefox.cjs | Playwright + mock data injection |

## CONVENTIONS

- **CJS format**: All scripts use `require()` for Node.js compatibility
- **No inter-script calls**: All orchestration via `package.json` npm scripts
- **postbuild:firefox pipeline**: fix-devtools-module → rewrite-firefox-manifest → sanitize-firefox-bundle → fix-content-scripts
- **release.cjs is standalone**: Inlines own version-bump logic, does NOT call bump-version.cjs

## ANTI-PATTERNS

- NEVER call scripts directly — use npm scripts in package.json
- NEVER modify dist-firefox/ manually — let postbuild scripts handle it
- NEVER hardcode AMO credentials — use dotenv (AMO_JWT_ISSUER, AMO_JWT_SECRET)

## NOTES

- rewrite-firefox-manifest.cjs is a no-op stub (content scripts now dynamically registered)
- esbuild is a transitive dep via Vite (not in devDependencies directly)
- External deps: web-ext (signing), playwright (screenshots), dotenv-cli (secrets), esbuild (bundling)
- AMO API uses JWT auth with issuer/secret from environment
- Screenshots stored in ../screenshots/ relative to scripts/
