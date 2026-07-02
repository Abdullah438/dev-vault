# DevVault - Encrypted API Key & Secrets Manager

DevVault is a developer-centric vault for generating, naming, and securely storing API keys or auth secrets. Secrets are encrypted **in your browser** (zero-knowledge) before they ever reach the server — only ciphertext is stored in the database.

## Features

- **Zero-Knowledge Encryption**: AES-256-GCM with Argon2id key derivation (KDF v2)
- **Glassmorphic Theme**: A premium, responsive dark mode design with micro-animations
- **Supabase Authentication**: Integrated social logins with Google and GitHub
- **Auto-Lock**: Vault locks after 15 minutes of inactivity
- **Passphrase Strength**: zxcvbn-powered strength meter for new vaults
- **Auditing Access Logs**: Automatic updates to `last_used_at` whenever a key is retrieved or copied
- **Security Headers**: CSP, HSTS, X-Frame-Options, and more

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Database/Auth**: Supabase PostgreSQL + Auth (Row Level Security)
- **Cryptography**: Web Crypto API + Argon2id (hash-wasm)
- **Package Manager**: pnpm

---

## Getting Started

### 1. Database Setup

Execute the SQL commands in [schema.sql](./schema.sql) using the Supabase SQL Editor. This creates:

- `secrets` table with RLS policies
- `user_vault_config` table for per-user Argon2id salts

### 2. Environment Configuration

Create `.env.local` with your Supabase connection parameters:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # optional — not used for secret CRUD
NEXT_PUBLIC_SITE_URL=http://localhost:3898        # production site URL for OAuth redirects
```

> **Note:** `ENCRYPTION_MASTER_KEY` is **not** used. Encryption is client-side only; your users' master passphrases derive the keys.

### 3. Run Development Server

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3898](http://localhost:3898) to view the application.

---

## Security Architecture

| Layer | Protection |
|-------|------------|
| **KDF v2** | Argon2id (64 MiB, 3 iterations) + 32-byte random per-user salt |
| **KDF v1 (legacy)** | PBKDF2 100k + UUID-derived salt — auto-migrates to v2 on unlock |
| **Encryption** | AES-256-GCM, 12-byte random IV per secret |
| **Transport** | HTTPS required in production |
| **Database** | Supabase RLS — users can only access their own rows |
| **API** | Session auth + per-IP rate limiting |
| **Session** | Vault auto-locks after 15 min idle; master key held only in memory |

### Migrating existing vaults

Users on the legacy KDF are automatically upgraded to Argon2id the next time they unlock their vault. All secrets are re-encrypted client-side during migration.
