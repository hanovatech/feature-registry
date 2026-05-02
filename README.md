# HanovaTech Feature Registry

Full-stack feature templates for HanovaTech client projects. Each feature provides Prisma schema fragments, API routes, Svelte components, Zod types, and i18n translations that get copied into a project and customized — like [shadcn](https://shadcn-svelte.com/), but for entire backend+frontend features.

**Live registry:** https://hanovatech.github.io/feature-registry/r/index.json

## How It Works

```
features/documents/          →  npm run build  →  dist/r/documents.json  →  GitHub Pages
  ├── manifest.json                                (all files inlined)
  ├── prisma/document.prisma
  ├── api/+server.ts
  ├── components/form.svelte
  ├── types/document.ts
  └── i18n/de.json, en.json
```

1. Features live as source files under `features/<name>/`
2. `npm run build` reads each manifest, inlines all file contents, outputs a single JSON per feature to `dist/r/`
3. GitHub Pages serves `dist/` — each feature is a self-contained JSON file
4. Consumer projects fetch the JSON and copy files into the correct locations

## Available Features

| Feature | Description | Endpoint |
|---------|-------------|----------|
| **documents** | S3 document management with presigned uploads, role-based access, soft-delete | [documents.json](https://hanovatech.github.io/feature-registry/r/documents.json) |

## Installing a Feature

Currently manual (CLI planned). Fetch the JSON and copy files into your SvelteKit project:

```bash
# 1. Fetch the feature JSON
curl -s https://hanovatech.github.io/feature-registry/r/documents.json > /tmp/documents.json

# 2. Extract files into your project (use the test script as reference)
#    - Copy files to their target paths
#    - Merge Prisma fragment into schema.prisma
#    - Merge i18n keys into en.json / de.json
#    - Add User relation (documents Document[])

# 3. Post-install
npx prisma migrate dev --name add_documents
npx prisma generate

# 4. Install npm dependencies listed in the feature JSON
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

Each feature's `manifest.json` lists all post-install steps. Files marked with `// CUSTOMIZE:` comments show where project-specific changes are needed.

## Adding a New Feature

Features are **extracted from real client projects**, not built in this repo. The workflow:

1. **Develop** the feature in a client project (e.g., apaton-app) until it works in production
2. **Identify** which parts are generic vs. project-specific
3. **Extract** the generic parts into `features/<name>/`
4. **Generalize** — replace project-specific entities/types with `// CUSTOMIZE:` placeholders
5. **Create** `manifest.json` describing all files, dependencies, and post-install steps
6. **Test** — `npm run build && npm test`
7. **Push** — CI validates, GitHub Pages deploys

### Feature Directory Structure

```
features/<name>/
├── manifest.json              # Metadata, file mappings, dependencies
├── prisma/
│   └── <name>.prisma          # Schema fragment (enums + models)
├── api/
│   ├── +server.ts             # List endpoint (GET)
│   └── [id]/+server.ts        # Detail/delete endpoints
├── components/
│   ├── form/form.svelte       # Create/edit form
│   └── data-table/
│       ├── columns.ts         # TanStack column definitions
│       ├── data-table.svelte  # Table with filters + pagination
│       └── data-table-actions.svelte
├── types/
│   └── <name>.ts              # Zod schemas + TypeScript types
├── utils/                     # Feature-specific utilities (optional)
└── i18n/
    ├── de.json                # German translations (feature keys only)
    └── en.json                # English translations
```

### Manifest Format

```json
{
  "name": "feature-name",
  "title": "Human Readable Name",
  "description": "What this feature does.",
  "version": "1.0.0",

  "dependencies": {
    "some-npm-package": "^1.0.0"
  },

  "uiRegistryDependencies": ["pagination", "page-header"],
  "featureRegistryDependencies": [],

  "requiredEnv": ["SOME_API_KEY"],

  "files": [
    {
      "source": "prisma/feature.prisma",
      "target": "prisma/fragments/feature.prisma",
      "type": "prisma-fragment",
      "hint": "Merge into your schema.prisma"
    },
    {
      "source": "api/+server.ts",
      "target": "src/routes/api/feature/+server.ts",
      "type": "api-route"
    },
    {
      "source": "components/form/form.svelte",
      "target": "src/lib/components/feature/form/form.svelte",
      "type": "component"
    },
    {
      "source": "types/feature.ts",
      "target": "src/lib/types/feature.ts",
      "type": "types"
    }
  ],

  "i18n": {
    "merge": true,
    "sources": { "de": "i18n/de.json", "en": "i18n/en.json" },
    "targetKey": "feature-name"
  },

  "postInstall": [
    "Merge Prisma fragment into schema.prisma",
    "npx prisma migrate dev --name add_feature",
    "npx prisma generate"
  ]
}
```

### File Type Reference

| Type | Target Pattern | Purpose |
|------|---------------|---------|
| `prisma-fragment` | `prisma/fragments/<name>.prisma` | Schema fragment — merged manually into `schema.prisma` |
| `api-route` | `src/routes/api/<name>/**` | SvelteKit API route handlers |
| `component` | `src/lib/components/<name>/**` | Svelte components (Layer 3 — editable) |
| `types` | `src/lib/types/<name>.ts` | Zod schemas + TypeScript types |
| `util` | `src/lib/utils/<name>.ts` | Utility functions / singletons |

### Conventions for Feature Code

- Mark every customization point with `// CUSTOMIZE:` comments
- Use Prisma relation `connect` syntax: `uploadedBy: { connect: { id: user.id } }`
- Keep role checks generic: ADMIN sees all, others see own data
- Use `$t.featureName.key` for all UI strings
- Follow all conventions from the [starter-app CLAUDE.md](https://github.com/hanovatech/starter-app/blob/main/CLAUDE.md)

## Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Build all features → `dist/r/*.json` |
| `npm test` | Integration test: install all features into starter-app, run `svelte-check` |
| `npm run dev` | Watch mode — rebuild on file changes |

## Testing

`npm test` runs a full integration test:

1. Clones [hanovatech/starter-app](https://github.com/hanovatech/starter-app)
2. Installs each feature from `dist/r/*.json`
3. Auto-merges Prisma schema fragments and i18n keys
4. Runs Prisma migrations against PostgreSQL
5. Runs `svelte-check` — fails on any type error
6. Cleans up

**Local testing** requires PostgreSQL on `localhost:5432`:

```bash
# Start PostgreSQL (or use the starter-app's Docker container)
docker exec starter-app-db-1 psql -U postgres -c "CREATE DATABASE feature_registry_test;"

# Run test
npm run build
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/feature_registry_test" npm test
```

**CI** runs automatically on push/PR via GitHub Actions with a PostgreSQL service container.

## Related Repositories

| Repo | Purpose |
|------|---------|
| [starter-app](https://github.com/hanovatech/starter-app) | SvelteKit base template for new client projects |
| [ui-registry](https://github.com/hanovatech/ui-registry) | Reusable UI components (shadcn-style, installed via CLI) |

## License

Proprietary — HanovaTech GmbH
