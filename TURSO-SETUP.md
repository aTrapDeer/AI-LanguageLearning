# Turso Setup

Laingfy stores all application data in Turso (libSQL): users and NextAuth records, per-language
progress, vocabulary with spaced-repetition state, pooled lessons and lesson attempts, daily activity
(XP and streaks), tutor chat sessions, recorded mistakes, per-user AI usage counters, and the shared
vocabulary pictures.

## Environment variables

Add these to `.env.local`:

```env
TURSO_DATABASE_URL="libsql://your-database-name-your-org.turso.io"
TURSO_AUTH_TOKEN="your-turso-auth-token"
AUTH_SECRET="replace-with-a-long-random-secret"
NEXTAUTH_SECRET="replace-with-the-same-secret-for-v4-compat"
NEXTAUTH_URL="http://localhost:3000"
```

### Local development without Turso

`@libsql/client` also accepts a local SQLite file. No token is needed:

```env
TURSO_DATABASE_URL="file:/absolute/path/to/dev.db"
```

The file is created on first use. This is also what the database tests use (with a temporary file).

## Schema management

The schema is created and migrated automatically the first time the app talks to the database
(`ensureDatabaseSchema` in `src/lib/db/client.ts`, statements in `src/lib/db/schema.ts`).
Migrations are additive only: missing tables and indexes are created, and new columns are added to
existing tables after checking `PRAGMA table_info`, so existing users and progress rows are kept.

To run the migration explicitly and print row counts:

```bash
npm run db:init
```

This reads `.env.local` (variables already set in the shell take precedence).

## Tables

| Table | Purpose |
| --- | --- |
| `users`, `accounts`, `sessions`, `verification_tokens` | Accounts and NextAuth adapter data |
| `progress` | Level (1–10) and cumulative XP per user and language |
| `learning` | Vocabulary items with spaced-repetition state, unique per user, language and normalised word |
| `lessons` | Generated lesson content, pooled per language and curriculum unit |
| `lesson_attempts` | A learner's run through a lesson: status, score, stars, XP, resume state |
| `daily_activity` | XP and activity counts per user, language and local date (streaks, daily goal) |
| `chat_sessions`, `chat_messages` | Tutor conversation memory |
| `mistakes` | Corrections the learner received, for targeted practice |
| `ai_usage` | Per-user daily counters for paid AI calls |
| `concept_images` | Vocabulary pictures (WebP bytes), one per English concept, shared by all learners and languages; `learning.image_key` links a word to its picture |
| `chats` | Legacy flat chat log (still written by the current chat routes) |
