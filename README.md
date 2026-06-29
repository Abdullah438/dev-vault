# DevVault - Encrypted API Key & Secrets Manager

DevVault is a developer-centric vault for generating, naming, and securely storing API keys or auth secrets. The application implements strong symmetric encryption (AES-256-GCM) on the server side, ensuring that raw keys are never stored in the database and can be securely retrieved and decrypted by authenticated developers at any time.

## Features

- **Glassmorphic Theme**: A premium, responsive dark mode design with micro-animations.
- **Supabase Authentication**: Integrated social logins with Google and GitHub.
- **Server-Side AES-256-GCM Encryption**: Secrets are encrypted on the server before storage.
- **Auditing Access Logs**: Automatic updates to `last_used_at` whenever a key is retrieved or copied.
- **Direct Copying & Revocation**: One-click clipboard actions and permanent key revocation.

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript
- **Styling**: Vanilla CSS (no framework wrappers)
- **Database/Auth**: Supabase PostgreSQL + Auth
- **Package Manager**: pnpm

---

## Getting Started

### 1. Database Setup
Execute the SQL commands in [schema.sql](file:///home/abdullah/Dev/Python/auth-secret-generator/schema.sql) using the Supabase SQL Editor. This will create the `secrets` table, index it, and configure row-level security (RLS).

### 2. Environment Configuration
Copy the `.env.local.example` template to `.env.local` and fill in your Supabase connection parameters:
```bash
cp .env.local.example .env.local
```

Make sure to specify:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ENCRYPTION_MASTER_KEY` (a 32-byte / 64-character hex key)

### 3. Run Development Server
Install dependencies and launch the dev server:
```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.
