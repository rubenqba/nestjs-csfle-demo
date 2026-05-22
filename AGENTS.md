# AGENTS.md

NestJS demo app for MongoDB Client-Side Field Level Encryption (CSFLE).
Single-package repo (the `pnpm-workspace.yaml` has no `packages:` entries — it only controls native build permissions).

## Prerequisites

- **Node.js ≥ 24** (`engines.node: ">= 24.0.0"` in `package.json`)
- **pnpm** — do not use `npm` or `yarn` (`packageManager: pnpm@11.2.2`)
- **Docker** — the demo uses `mongodb/mongodb-enterprise-server`; however, the explicit encryption + automatic decryption pattern used here works with Community Server too — only fully automatic encryption requires Enterprise

Start the database before running the app or e2e tests:

```sh
docker compose up -d   # starts mongodb/mongodb-enterprise-server on host port 47017
```

## Environment

`.env` is gitignored but a development copy is committed (demo convenience). Required variables:

| Variable           | Notes                                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| `MONGODB_URI`      | Default: `mongodb://admin:secret@localhost:47017/?authSource=admin` — note port **47017**, not 27017 |
| `LOCAL_MASTER_KEY` | Base64 string that **must decode to exactly 96 bytes**. App throws at startup if wrong.              |

## Developer Commands

```sh
pnpm build          # nest build (wipes dist/ each time via deleteOutDir: true)
pnpm start:dev      # nest start --watch
pnpm lint           # eslint with --fix (type-aware; requires valid tsconfig)
pnpm format         # prettier --write
```

Run a single test file:
```sh
pnpm test -- --testPathPattern=<filename>
```

## Architecture

```
src/
  main.ts             # Bootstrap, listens on PORT (default 3000)
  app.module.ts       # Root module: ConfigModule, MongooseModule (with autoEncryption), wires all providers
  app.controller.ts   # POST / (create person), GET /?ssn=… (find by SSN)
  app.service.ts      # Thin delegation layer
  app.repository.ts   # Mongoose repo + CSFLE explicit encrypt/decrypt logic
  app.schema.ts       # AppModuleOptions type ({ keyName: string })
```

**Key vault:** `encryption.__keyVault`. On startup, `PeopleRepository.onModuleInit()` creates a data key with `altName = 'csfle-demo-key'` if one does not exist.

## CSFLE Implementation — Critical Facts

- **`bypassAutoEncryption: true`** is set on the Mongoose connection. This means schema-based transparent encryption is disabled. All field encryption is **explicit** (manual) in `app.repository.ts`.
- Encrypted fields use `type: mongoose.Schema.Types.Mixed` in the schema so Mongoose accepts either a `Binary` (encrypted blob) or `string`.
- Encryption algorithms:
  - `ssn` → `Deterministic` — allows equality queries; used as the upsert filter key
  - `phone`, `email` → `Random` — cannot be queried directly
- The `clientEncryption()` method on the Mongoose model is provided by the `mongodb-client-encryption` integration when `autoEncryption` is configured.

## Native Module Build

`mongodb-client-encryption` includes a native C++ addon (`mongocrypt`). `pnpm-workspace.yaml` allows its install script:

```yaml
allowBuilds:
  mongodb-client-encryption: true
```

If you see install errors related to `mongocrypt`, check that this flag is present and that Node.js native build tools (`node-gyp`, Python, C++ compiler) are available.

## Style Conventions

- Single quotes, trailing commas (`all`), 2-space indent, LF line endings, max line length 140
- ESLint uses `recommendedTypeChecked` (type-aware) — linting invokes the TypeScript compiler
- ESLint `sourceType` is `commonjs` despite TypeScript using `moduleResolution: nodenext` — a scaffold quirk, do not change without understanding the impact
- `@typescript-eslint/no-explicit-any` is off; `no-floating-promises` and `no-unsafe-argument` are warnings, not errors
