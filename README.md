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
- **Model**: edit `CHAT_MODEL` in `lib/anthropic.ts` (currently `claude-haiku-4-5`).
- **Embedding the widget elsewhere**: import `SupportChat` from `app/components/SupportChat.tsx`
  into any other page or layout.

## Weather agent demo

Two standalone scripts under `weather-agent/` show Claude's tool-use agent loop end to end,
using a `get_weather` tool backed by the free [Open-Meteo](https://open-meteo.com/) API (no key
needed for the weather lookup itself):

- `npm run weather -- "Tokyo"` - hand-written manual loop (`weather-agent/weather-agent.ts`):
  calls `messages.create()`, inspects `stop_reason`, executes the tool, and feeds the result back
  itself. Logs each turn's decision so you can see the loop mechanics.
- `npm run weather:runner -- "Tokyo"` - same agent using the SDK's beta Tool Runner
  (`weather-agent/weather-agent-tool-runner.ts`, `client.beta.messages.toolRunner`): the tool's
  `run()` function is called automatically, so there's no manual `tool_use`/`tool_result`
  plumbing - the runner drives the loop.

Both prompt for a location if you don't pass one as an argument, and both need
`ANTHROPIC_API_KEY` set (via `.env.local`, auto-loaded by these scripts, or your shell env).

## Deploy

Set `ANTHROPIC_API_KEY` as an environment variable on your hosting provider (e.g. Vercel project
settings), then deploy as a normal Next.js app. See the
[Next.js deployment docs](https://nextjs.org/docs/app/building-your-application/deploying) for details.
