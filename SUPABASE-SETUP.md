# Supabase Database Setup for Language Learning App

This guide walks you through setting up your Supabase PostgreSQL database for the language learning application.

## Prerequisites

- A Supabase account and project created
- Node.js and npm installed
- Access to your project codebase

## Step 1: Configure Environment Variables

1. Copy the `.env.local.example` file to `.env.local`:
   ```
   cp .env.local.example .env.local
   ```

2. Edit `.env.local` and add your Supabase credentials:
   - `DATABASE_URL`: Your Supabase PostgreSQL connection string
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon/public key
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (for migrations)

You can find these credentials in your Supabase project dashboard under Project Settings > API.

## Step 2: Create Database Tables

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy the SQL from `supabase-schema.sql` in your project
4. Run the SQL to create all tables and indexes

Alternatively, you can run the SQL from the command line using the Supabase CLI or psql if you have it set up.

## Step 3: Migrate Existing Data (If Any)

If you have existing data in another PostgreSQL database (like AWS RDS), you can migrate it using our migration script:

```
npm run migrate:supabase
```

This will copy all your existing data to Supabase while maintaining relationships.

## Step 4: Update Your Application

The application has been updated to use Supabase. The main changes are:

1. A new Supabase client in `src/lib/supabase.ts`
2. Database helpers in `src/lib/supabase-db.ts`
3. Updated environment variables

## Step 5: Test Your Setup

Run your application and verify everything works correctly:

```
npm run dev
```

Make sure features like user registration, login, and all database-dependent features work correctly.

## Troubleshooting

- **Connection Issues**: Double-check your DATABASE_URL and Supabase credentials
- **Missing Tables**: Verify that all tables were created in the Supabase dashboard
- **Migration Errors**: Check any error messages during migration and address them specifically

## Database Schema

The database includes the following tables:

- `users`: User accounts
- `accounts`: Authentication provider accounts
- `sessions`: User sessions
- `verification_tokens`: Email verification tokens
- `progress`: User language learning progress
- `learning`: User's learning items
- `chats`: Conversation history
- `vocabulary`: User's vocabulary items
- `visual_learning`: Visual learning exercises
- `speech`: Speech practice records

Each table includes appropriate indexes and foreign key relationships.

## Row Level Security (RLS)

Supabase provides Row Level Security to protect your data. The SQL script includes RLS policies that:

1. Only allow users to see their own data
2. Prevent users from viewing or modifying other users' data
3. Secure sensitive operations

These policies can be viewed and modified in the Supabase dashboard under Authentication > Policies. 