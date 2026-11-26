# Laingfy - AI-Powered Language Learning

Laingfy is a language-learning web app (mobile-first) that uses OpenAI models to generate practice
content and hold conversations in the language you are learning.

Languages: German, Brazilian Portuguese, Chinese (Mandarin), Norwegian, Korean and Arabic
(defined once in `src/lib/language-config.ts`).

## What's in the app today

- **Onboarding** – pick languages and a starting level; levels use one 1–10 scale mapped to CEFR bands.
- **Journey mode** – generated exercise rounds (sentence building, fill-in-the-blank, vocabulary).
- **Flashcards** – generated vocabulary decks for your level.
- **Conversation practice** – text and voice chat with an AI tutor, with spoken replies.
- **Travel mode** – live speech translation and reply suggestions for real-world situations.

The data layer also contains the foundations for a structured curriculum, spaced-repetition review,
XP/streaks and tutor memory (`src/lib/curriculum.ts`, `src/lib/srs.ts`, `src/lib/gamification.ts`,
`src/lib/db/*`), which the learning screens are being moved onto.

## Tech stack

- Next.js 15 (App Router) with React 18 and TypeScript
- Tailwind CSS 3, shadcn-style components (`src/components/ui`), framer-motion
- NextAuth v4 (credentials, optional Google OAuth) with JWT sessions
- Turso / libSQL via `@libsql/client` (hand-written queries, schema auto-migrated)
- OpenAI (chat completions, text-to-speech, transcription, Realtime API for voice)
- AWS S3 for storing generated chat audio
- Vitest for unit and database tests

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env.local` and fill in:
   - `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` – or, for local development, a SQLite file:
     `TURSO_DATABASE_URL="file:/absolute/path/to/dev.db"` (no token needed)
   - `AUTH_SECRET` and `NEXTAUTH_SECRET` (same value), `NEXTAUTH_URL`
   - `OPENAI_API_KEY` for any AI feature
   - `AWS_*` variables if you want spoken chat replies stored in S3
3. Start the dev server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

The database schema is created automatically on first use; see [TURSO-SETUP.md](./TURSO-SETUP.md).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` / `npm start` | Production build / serve it |
| `npm run lint` | ESLint (Next.js config) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Run the Vitest suite once (`npm run test:watch` to watch) |
| `npm run db:init` | Create/migrate the database schema and print table counts |

## Notes

- Every API route except NextAuth and `/api/register` requires a signed-in session
  (`src/lib/api-auth.ts`); the user id always comes from the session.
- AI routes are protected by a per-user daily quota stored in the database. Defaults can be changed
  with `AI_DAILY_LIMIT_TEXT`, `AI_DAILY_LIMIT_SPEECH`, `AI_DAILY_LIMIT_TRANSCRIPTION` and
  `AI_DAILY_LIMIT_REALTIME` (a value of 0 or less removes the cap).
- Model names can be overridden with `OPENAI_TEXT_MODEL`, `OPENAI_TTS_MODEL`,
  `OPENAI_TRANSCRIPTION_MODEL` and the `OPENAI_REALTIME_*` variables.

## License

Copyright © 2024 Laingfy. All rights reserved.
