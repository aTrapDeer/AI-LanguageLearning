# Turso Setup

This project now uses Turso for application data, auth persistence, progress tracking, and chat logging.

## Required environment variables

Add these values to `.env.local`:

```env
TURSO_DATABASE_URL="libsql://your-database-name-your-org.turso.io"
TURSO_AUTH_TOKEN="your-turso-auth-token"
AUTH_SECRET="replace-with-a-long-random-secret"
NEXTAUTH_SECRET="replace-with-the-same-secret-for-v4-compat"
NEXTAUTH_URL="http://localhost:3000"
```

## Optional authentication providers

Google OAuth is optional. Leave these empty until you are ready to wire Google sign-in:

```env
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
```

## What Turso stores

- Users
- NextAuth accounts
- NextAuth sessions
- Verification tokens
- Learning progress
- Learning items
- Chat history and audio metadata

## Schema management

The app creates its required tables automatically when it first connects to Turso, and you can also bootstrap them explicitly with:

```bash
npm run db:init
```

This will connect using `.env.local`, create any missing tables/indexes, and print current row counts for the main application tables.
