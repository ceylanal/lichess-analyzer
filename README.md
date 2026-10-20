# Lichess Analyzer

An experimental chess-analysis web application that imports public Lichess games, replays moves on an interactive board, and combines Stockfish position evaluation with Turkish AI commentary through Groq.

## Features

- Loads up to 50 recent rapid/blitz games for a Lichess username.
- Interactive board, move navigation, and position evaluation.
- Browser-worker Stockfish integration and a play-against-engine mode.
- AI commentary with different coaching personas through `/api/analyze`.
- Experimental account and subscription interface inherited from a SaaS starter.

## Stack

Next.js 14, React, TypeScript, chess.js, react-chessboard, Stockfish, Groq, and Supabase/Stripe starter components.

## Run locally

```bash
git clone https://github.com/ceylanal/lichess-analyzer.git
cd lichess-analyzer
npm ci
```

For AI commentary, add a server-side `.env.local` file:

```dotenv
GROQ_API_KEY=
```

Then start the application:

```bash
npm run dev
```

Open `http://localhost:3000`. Public Lichess game import and the engine require network access. The AI analysis route reads `GROQ_API_KEY`; keys must remain outside version control.

Supabase authentication and Stripe subscription routes need their own provider configuration. Those components are retained from the starter and are separate from the core chess exploration flow.

## Project status

This is an early prototype. The current account/pro interface includes simulated state, and end-to-end billing and access enforcement have not been established by this documentation update. Groq commentary is a language-model explanation, separate from Stockfish’s position score. AI requests currently use a truncated PGN context.

## Repository map

| Path | Purpose |
| --- | --- |
| `app/page.tsx` | Chess interface, game import, engine worker, and commentary UI |
| `app/api/analyze/route.ts` | Server-side Groq commentary endpoint |
| `components/` | Shared interface and inherited account components |
| `utils/` | Supabase, authentication, and Stripe helpers |
| `public/` | Static assets and engine-related files |

## Attribution

Developed with Gemini assistance, with Groq used for runtime commentary. The repository includes code from the [Next.js Subscription Payments starter](https://github.com/vercel/nextjs-subscription-payments). See [LICENSE](LICENSE); third-party components retain their own licenses.
