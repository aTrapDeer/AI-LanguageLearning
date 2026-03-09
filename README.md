# Laingfy - AI-Powered Language Learning Platform

Laingfy is an innovative language learning platform that leverages artificial intelligence to provide personalized, interactive language learning experiences. Our platform offers real-time conversation practice, pronunciation feedback, and adaptive learning paths tailored to each user's needs.

## Features

- **AI Conversation Practice**: Engage in natural conversations with our AI language tutors
- **Speech Recognition**: Get real-time pronunciation feedback
- **Visual Learning**: Practice describing AI-generated images in your target language
- **Personalized Learning**: Content adapted to your interests and skill level
- **Multiple Languages**: Support for German, Brazilian Portuguese, Chinese, Norwegian, and more coming soon

## Getting Started

1. Clone the repository
2. Install dependencies:
```bash
npm install
```
3. Copy `.env.example` to `.env.local` and fill in your values.
4. Create a Turso database and add:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `AUTH_SECRET` / `NEXTAUTH_SECRET`
5. Add `OPENAI_API_KEY` and the optional provider/service keys you plan to use.
6. Run the development server:
```bash
npm run dev:all
```

Open [http://localhost:3000](http://localhost:3000) with your browser to start learning!

## Technology Stack

- React 19 with TypeScript
- Tailwind CSS for styling
- LiveKit for real-time audio processing
- OpenAI for natural language processing
- Turso (libSQL) for application data, auth data, and logging
- NextAuth.js `4.24.13` for authentication
- Redis for realtime and supporting services

## Authentication Notes

- Email/password auth is enabled out of the box.
- Google OAuth is optional and only activates when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set.
- User, account, session, verification token, progress, learning, and chat records are stored in Turso.

## Database Notes

- The app initializes its required Turso tables automatically on first use.
- Chat history and learning progress are now written to Turso instead of Supabase.

## Contributing

We welcome contributions! Please see our contributing guidelines for more details.

## License

Copyright © 2024 Laingfy. All rights reserved.
