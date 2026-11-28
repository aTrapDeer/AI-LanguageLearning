# Laingfy - AI-Powered Language Learning

Laingfy is a language-learning web app (mobile-first) that uses OpenAI models to generate practice
content and hold conversations in the language you are learning.

Languages: German, Brazilian Portuguese, Chinese (Mandarin), Norwegian, Korean and Arabic
(defined once in `src/lib/language-config.ts`).

## What's in the app today

- **Onboarding** – pick languages and a starting level; levels use one 1–10 scale mapped to CEFR bands (A1–C2).
- **Lesson path** (`/learn/journey`) – 60 curriculum units, six per level. Each lesson teaches new words,
  then tests them with choice, listening, matching, fill-in, sentence-building and typed-recall exercises.
  Missed exercises come back at the end; finishing awards stars and XP and adds the words to your review deck.
- **Vocabulary pictures** – words that can be drawn (objects, food, animals, places, simple actions) get a
  small text-free illustration on their intro card, on "How do you say this?" questions and on the answer
  side of review cards. Each picture is generated once per English concept with the OpenAI Images API,
  stored as a ~512 px WebP in the database and shared by every learner and language ("der Apfel",
  "a maçã" and "苹果" all use one "apple" picture). Lessons never wait more than a few seconds for them
  and work the same without them.
- **Review** (`/flashcards`) – spaced repetition over your own words (Again / Hard / Good / Easy), plus a
  "My words" view to search, add and remove vocabulary.
- **Chat tutor** (`/learn/<language>`) – remembers the conversation, adapts to your level and current unit,
  corrects mistakes gently, suggests replies, and lets you save words to the deck. Audio is generated on demand.
- **Voice conversation** (`/learn/conversation`) – live speech practice over the OpenAI Realtime API, with
  instructions built from your level and weak words.
- **Travel mode** (`/travel`) – live speech translation and reply suggestions for real-world situations.
- **Dashboard** – streak, daily XP goal, level progress, reviews due and the next lesson.

Without an `OPENAI_API_KEY` the first lesson of each language still works from built-in starter content;
other AI features show an "unavailable" state.

## Tech stack

- Next.js 15 (App Router) with React 18 and TypeScript
- Tailwind CSS 3, shadcn-style components (`src/components/ui`), framer-motion
- NextAuth v4 (credentials, optional Google OAuth) with JWT sessions
- Turso / libSQL via `@libsql/client` (hand-written queries, schema auto-migrated)
- OpenAI via the `openai` SDK 7 (Chat Completions with structured outputs, file transcription,
  Realtime API for voice conversations and for read-aloud speech, Images API); needs Node.js 22+
- sharp for normalising generated pictures to WebP
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

- Every API route except NextAuth, `/api/register` and `/api/images/:id` requires a signed-in session
  (`src/lib/api-auth.ts`); the user id always comes from the session. `/api/images/:id` serves only the
  shared vocabulary pictures (random UUIDs, cached as immutable) and no user data.
- AI routes are protected by a per-user daily quota stored in the database. Defaults can be changed
  with `AI_DAILY_LIMIT_TEXT`, `AI_DAILY_LIMIT_SPEECH`, `AI_DAILY_LIMIT_TRANSCRIPTION`,
  `AI_DAILY_LIMIT_REALTIME` and `AI_DAILY_LIMIT_IMAGE` (a value of 0 or less removes the cap).
- Model names can be overridden with environment variables. Defaults:

  | Used for | Variable | Default |
  | --- | --- | --- |
  | Lessons, tutor, review words, travel text | `OPENAI_TEXT_MODEL` | `gpt-6-luna` |
  | Listen button (`/api/tts`) | `OPENAI_TTS_MODEL` | `gpt-realtime-2.1-mini` |
  | Chat microphone (`/api/transcribe`) | `OPENAI_TRANSCRIPTION_MODEL` | `gpt-transcribe` |
  | Voice conversation and travel mode | `OPENAI_REALTIME_MODEL` | `gpt-realtime-2.1` |
  | Transcripts inside realtime sessions | `OPENAI_REALTIME_TRANSCRIPTION_MODEL` | `gpt-transcribe` |
  | Vocabulary pictures | `OPENAI_IMAGE_MODEL` | `gpt-image-2.6-flare` |

  - Text generation uses Chat Completions with `reasoning_effort` set by `OPENAI_TEXT_REASONING_EFFORT`
    (default `none`, which keeps replies fast; `off` leaves the parameter out). When reasoning is on,
    `temperature` is not sent, as reasoning models reject it.
  - Speech no longer uses the Speech API (`/v1/audio/speech`), whose models shut down on Jan 6, 2027.
    `/api/tts` opens a short server-side Realtime WebSocket session (`src/lib/realtime-speech.ts`), has
    the model read the text and returns the audio as WAV. `OPENAI_TTS_MODEL` must therefore be a
    Realtime model, and `OPENAI_TTS_VOICE` (default `marin`) a Realtime voice. The browser's own
    speech synthesis remains the fallback when this fails.
  - `gpt-transcribe` takes its language hint as a `languages` list; the code still sends the single
    `language` field when an older transcription model is configured.
- Vocabulary pictures: `LESSON_IMAGES=off` turns them off completely (nothing generated or shown). By
  default a newly generated lesson starts up to `LESSON_IMAGES_PER_LESSON` (4) pictures and waits at
  most `LESSON_IMAGES_WAIT_MS` (10000) for them; the rest finish in the background and later lessons fill
  in what is missing. Requests use `OPENAI_IMAGE_MODEL` (`gpt-image-2.6-flare`), `OPENAI_IMAGE_QUALITY`
  (`low`) and `OPENAI_IMAGE_SIZE` (`1024x1024`); `OPENAI_IMAGE_COMPLEXITY` defaults to `low` for 2.6 models (`off` disables it). A failed
  picture is retried later with back-off (10 minutes, doubling, at most daily).

## License

Copyright © 2024 Laingfy. All rights reserved.
