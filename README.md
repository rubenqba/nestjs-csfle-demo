# NestJS CSFLE Demo

A demo application exploring [MongoDB Client-Side Field Level Encryption (CSFLE)](https://www.mongodb.com/docs/manual/core/csfle/) with NestJS and Mongoose.

## Goal

The specific pattern under test is **explicit encryption with automatic decryption**:

- Fields are encrypted **manually** in application code before being written to MongoDB (`bypassAutoEncryption: true` disables schema-based auto-encryption on write).
- Fields are decrypted **automatically** by the MongoDB driver when reading, without any application-side decrypt calls.

This means the application calls `clientEncryption.encrypt()` explicitly before every write, but plain-text values come back from `findOne` / `findOneAndUpdate` without any corresponding `decrypt()` call.

This approach was chosen as the simplest entry point into CSFLE. The fully automatic mode (transparent encrypt and decrypt on both read and write) requires the [`mongocrypt_shared`](https://www.mongodb.com/docs/manual/core/csfle/reference/shared-library/) shared library to be present and loaded by the driver — an additional external dependency that adds friction to local development and deployment. By using `bypassAutoEncryption: true`, this demo avoids that requirement entirely while still exercising the core encryption mechanics.

Full automatic mode (both directions handled transparently by the driver) is planned as a follow-up experiment in this same project.

## How CSFLE is Wired

### Connection (`app.module.ts`)

```ts
autoEncryption: {
  keyVaultNamespace: 'encryption.__keyVault',
  kmsProviders: { local: { key: localMasterKey } },
  bypassAutoEncryption: true,   // <-- disables automatic encryption on write
},
```

`bypassAutoEncryption: true` tells the driver to skip its automatic encrypt-on-write path entirely. The driver still performs automatic decrypt-on-read for any `BinData` subtype 6 (encrypted) fields it encounters in query results.

### Key Management (`app.repository.ts` — `onModuleInit`)

On startup, the repository checks the key vault for a data key with `altName = 'csfle-demo-key'`. If none exists it creates one using the `local` KMS provider. The key vault namespace is `encryption.__keyVault`.

### Encryption Algorithms

| Field   | Algorithm                                                       | Reason                                                                                                               |
| ------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `ssn`   | `Deterministic` (`AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic`) | Same plaintext always produces the same ciphertext — required for equality queries and used as the upsert filter key |
| `phone` | `Random` (`AEAD_AES_256_CBC_HMAC_SHA_512-Random`)               | Non-deterministic; cannot be queried directly                                                                        |
| `email` | `Random` (`AEAD_AES_256_CBC_HMAC_SHA_512-Random`)               | Non-deterministic; cannot be queried directly                                                                        |

### Mongoose Schema

Encrypted fields are declared as `type: mongoose.Schema.Types.Mixed` so Mongoose accepts either a `Binary` BSON blob (encrypted, as stored) or a `string` (plaintext, after decryption by the driver).

## API

| Method | Route           | Description                                                                            |
| ------ | --------------- | -------------------------------------------------------------------------------------- |
| `POST` | `/`             | Create or update a person. Body: `{ name, age, ssn, phone, email }`. Upserts on `ssn`. |
| `GET`  | `/?ssn=<value>` | Find a person by SSN.                                                                  |

`ssn` is the identity key — posting the same SSN again updates the existing record.

## Setup

### Prerequisites

- Node.js ≥ 24
- pnpm (`corepack enable` or install separately)
- Docker — the demo uses the `mongodb/mongodb-enterprise-server` image, but technically the explicit encryption + automatic decryption pattern used here [works with MongoDB Community Server as well](https://www.mongodb.com/docs/manual/core/csfle/fundamentals/manual-encryption/); Enterprise is only required for fully automatic encryption

### 1. Start MongoDB

```sh
docker compose up -d
```

This starts `mongodb/mongodb-enterprise-server` on host port **47017** (mapped from container port 27017).

### 2. Install dependencies

```sh
pnpm install
```

`mongodb-client-encryption` includes a native C++ addon and must compile during install. Requires `node-gyp`, Python, and a C++ compiler.

### 3. Environment

A `.env` file with development defaults is committed:

```
LOCAL_MASTER_KEY=<base64>   # must decode to exactly 96 bytes
MONGODB_URI=mongodb://admin:secret@localhost:47017/?authSource=admin
```

`LOCAL_MASTER_KEY` is validated at startup — the app throws if it does not decode to exactly 96 bytes.

To generate a fresh key:

```sh
# OpenSSL (macOS / Linux)
openssl rand -base64 96

# Node.js
node -e "console.log(require('crypto').randomBytes(96).toString('base64'))"
```

### 4. Run

```sh
pnpm start:dev
```

The app listens on port 3000 by default (`PORT` env var overrides).

## Usage Example

```sh
# Create a person
curl -s -X POST http://localhost:3000 \
  -H 'Content-Type: application/json' \
  -d '{"name":"Alice","age":30,"ssn":"123-45-6789","phone":"555-0100","email":"alice@example.com"}' | jq

# Retrieve by SSN
curl -s 'http://localhost:3000?ssn=123-45-6789' | jq
```

The returned document will have `ssn`, `phone`, and `email` as plaintext strings — decrypted automatically by the driver — even though they are stored as encrypted `BinData` in MongoDB.

## Commands

```sh
pnpm build          # compile to dist/ (dist/ is wiped on each build)
pnpm start:dev      # run with watch mode
pnpm lint           # ESLint with --fix (type-aware)
pnpm format         # Prettier
pnpm test:e2e       # e2e tests (requires MongoDB running)
```

## Project Structure

```
src/
  main.ts             # Bootstrap
  app.module.ts       # Mongoose connection with autoEncryption config
  app.controller.ts   # POST / and GET /?ssn=…
  app.service.ts      # Thin delegation to repository
  app.repository.ts   # Explicit encrypt logic + Mongoose schema
  app.schema.ts       # AppModuleOptions type
docker-compose.yml    # MongoDB Enterprise image on port 47017 (Community also works for this pattern)
```
