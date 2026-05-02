# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## What This Is

The HanovaTech Feature Registry — a collection of reusable backend feature templates for SvelteKit projects. Features are extracted from real client projects, generalized, and served as JSON via GitHub Pages. Consumer projects fetch the JSON and copy the files in.

**This repo does NOT contain a runnable SvelteKit app.** The source files under `features/` use imports like `$lib/utils/prisma` and `zod` that don't exist here. The code is only validated when installed into a real project via `npm test`.

**Features contain backend only — no UI components.** Each feature provides Prisma schema, API routes, Zod types, utils, and i18n keys. UI (DataTables, Forms, Pages) is always built project-specifically using components from the [ui-registry](https://github.com/hanovatech/ui-registry).

## Commands

```bash
npm run build    # Build all features → dist/r/*.json
npm test         # Integration test: install into starter-app + svelte-check
npm run dev      # Watch mode — rebuild on file changes
```

## Repository Structure

```
features/                    # Feature source files (one dir per feature)
  <name>/
    manifest.json            # Metadata, file list, dependencies
    prisma/<name>.prisma     # Prisma schema fragment
    api/**                   # SvelteKit API routes
    types/<name>.ts          # Zod schemas
    utils/                   # Utilities (optional)
    i18n/de.json, en.json    # Translations (feature keys only)

scripts/
  build.ts                   # Reads manifests, inlines files → dist/r/*.json
  test-features.ts           # Clones starter-app, installs features, type-checks

dist/r/                      # Build output (served via GitHub Pages)
  index.json                 # Feature index
  <name>.json                # Self-contained feature JSON
```

## How the Build Works

`scripts/build.ts` for each feature:
1. Reads `manifest.json`
2. Reads every file listed in `files[]`
3. Inlines the file content as a string
4. Reads and inlines i18n JSON
5. Writes a single `dist/r/<name>.json` with everything

## How the Test Works

`scripts/test-features.ts`:
1. Clones `hanovatech/starter-app` into `.test-app/`
2. Runs `npm ci`
3. For each feature in `dist/r/`:
   - Copies files to their target paths
   - Skips files that already exist and have a `hint` containing "merge"
   - Merges i18n keys into `en.json` / `de.json`
   - Merges Prisma schema fragment (appends models, adds User relations)
   - Installs npm dependencies
4. Runs `prisma generate` + `prisma migrate`
5. Runs `svelte-check` — exits 1 on any type error
6. Cleans up `.test-app/`

## Adding a New Feature

Features are **extracted from real client projects**, never built from scratch in this repo.

### Step by step:

1. Create `features/<name>/manifest.json` with metadata and file list
2. Copy the generalized backend source files into `features/<name>/`
3. Ensure every customization point has a `// CUSTOMIZE:` comment
4. Run `npm run build` — check that the JSON is generated
5. Run `npm test` — check that it installs cleanly and passes type-check
6. Commit and push — CI runs the test, GitHub Pages deploys

### Manifest rules:

- `files[].source` — path relative to the feature directory
- `files[].target` — path relative to the consumer project root
- `files[].type` — one of: `prisma-fragment`, `api-route`, `types`, `util`
- `files[].hint` — shown during install, used by test script to detect merge-vs-overwrite
- `i18n.targetKey` — the key under which translations are merged (e.g., `"documents"`)
- `postInstall` — human-readable steps shown after install

### Code conventions in feature files:

- Mark customization points: `// CUSTOMIZE: <what to change>`
- Use Prisma `connect` for relations: `uploadedBy: { connect: { id: user.id } }`
- Auth pattern: `if (!user) return error(401); if (user.role !== 'ADMIN') return error(403);`
- Generic role scoping: ADMIN sees all, others see own data via `uploadedById`
- Validation: Zod schemas in `types/`, validate before DB access
- Logging: use `logger` from `$lib/utils/logger`, never `console.log`
- Pagination: `page`/`limit` params, return `PaginatedResponse<T>`
- Soft delete: `deletedAt: null` filter in queries

### What NOT to include in a feature:

- **UI components** (DataTables, Forms, Badges) — always project-specific
- **Page routes** (`src/routes/(app)/`) — always project-specific
- Project-specific entity relations (use `// CUSTOMIZE:` placeholders)
- Project-specific business logic (Provisions, Referrals, etc.)
- Layout components (Sidebar, Topbar) — those belong in the project

## Keeping Things in Sync

- When the **starter-app** changes its base structure (new utils, schema changes), the test will catch incompatibilities automatically
- When a **feature** changes, CI re-runs the full integration test
- The **ui-registry** is independent — features don't bundle UI components
