A [Next.js](https://nextjs.org) support chat application powered by the [Claude API](https://docs.claude.com).

## Features

- Floating support-chat widget (`app/components/SupportChat.tsx`) with a streamed, typewriter-style
  assistant response.
- Streaming API route (`app/api/chat/route.ts`) that proxies requests to Claude using the
  [Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript), so the API key
  never reaches the browser.
- Configurable support persona/system prompt in `lib/anthropic.ts`.

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Add your Anthropic API key:

   ```bash
   cp .env.local.example .env.local
   # then edit .env.local and set ANTHROPIC_API_KEY
   ```

3. Run the dev server:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) and click the chat bubble in the
   bottom-right corner.

## Project structure

```
app/
  api/chat/route.ts        Streaming Claude API proxy (POST /api/chat)
  components/SupportChat.tsx  Floating chat widget UI
  page.tsx                 Demo landing page hosting the widget
lib/anthropic.ts           Anthropic client, model id, and system prompt
```

## Customizing

- **Persona / instructions**: edit `SUPPORT_SYSTEM_PROMPT` in `lib/anthropic.ts`.
- **Model**: edit `CHAT_MODEL` in `lib/anthropic.ts` (defaults to `claude-opus-5`).
- **Embedding the widget elsewhere**: import `SupportChat` from `app/components/SupportChat.tsx`
  into any other page or layout.

## Deploy

Set `ANTHROPIC_API_KEY` as an environment variable on your hosting provider (e.g. Vercel project
settings), then deploy as a normal Next.js app. See the
[Next.js deployment docs](https://nextjs.org/docs/app/building-your-application/deploying) for details.
