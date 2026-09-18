# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm install                        # install dependencies
npm run dev                        # start Next.js dev server (Turbopack, port 3000)
npm run build                      # production build
npm run start                      # run the production build
npm run lint                       # eslint (flat config: eslint-config-next core-web-vitals + typescript)
npx tsc --noEmit                   # typecheck (no separate "typecheck" script exists)

npm run weather -- "<location>"           # manual tool-use loop weather agent (CLI)
npm run weather:runner -- "<location>"    # same agent via the SDK's beta Tool Runner
```

There is no test suite in this repo.

### Environment

Both the web app and the `weather-agent/` scripts need Claude API credentials:

```bash
cp .env.local.example .env.local   # then set ANTHROPIC_API_KEY
```

`npm run dev`/`build`/`start` load `.env.local` automatically (Next.js). The `weather-agent`
scripts are run via `tsx` outside of Next.js, so they load it explicitly via
`--env-file-if-exists=.env.local` in their npm scripts — don't drop that flag if you rename or add
a script that runs one of these files directly.

## Architecture

This repo is two independent things sharing one Next.js/TypeScript project: a **support chat web
app** and a set of **standalone CLI agent demos**. They don't share code.

### Support chat web app

- `lib/anthropic.ts` — the single shared `Anthropic` client, `CHAT_MODEL`, and
  `SUPPORT_SYSTEM_PROMPT`. This is the one place to change the model or the assistant's persona
  for the web widget.
- `app/api/chat/route.ts` — Node runtime route handler. Validates the posted message history
  (role/length/shape) before calling Claude, then streams the reply back as **raw text chunks**
  over a `ReadableStream` (not SSE, no `EventSource`) via `messages.stream()` + the `"text"`
  event. Errors (including Anthropic auth/API errors) are caught and turned into a plain-text
  fallback message rather than a non-200 response, so the client never has to handle a failed
  stream separately from a normal one.
- `app/components/SupportChat.tsx` — client component implementing the floating chat bubble.
  Holds the full conversation in React state and resends the entire history on every request
  (the Messages API is stateless); reads the response body with a plain `fetch` +
  `getReader()`/`TextDecoder` loop that matches the route's raw-text streaming format.
- `app/page.tsx` mounts `<SupportChat />` on the landing page; mount it elsewhere to reuse the
  widget on another page.

### Weather agent demos (`weather-agent/`)

Two scripts implement the *same* `get_weather` tool-use agent two different ways, run directly
via `tsx` (not part of the Next.js app, no imports from `app/` or `lib/`):

- `weather-agent.ts` — hand-written manual loop: `client.messages.create()` in a `for` loop,
  inspecting `stop_reason`, building `tool_use`/`tool_result` blocks and pushing them back onto
  `messages` by hand. Logs each turn's `stop_reason` and Claude's tool-call decision.
- `weather-agent-tool-runner.ts` — the same agent built on the SDK's beta Tool Runner
  (`client.beta.messages.toolRunner` + `betaZodTool`): the tool's `run()` callback is invoked by
  the SDK automatically, so there's no manual `tool_use`/`tool_result` wiring; the script iterates
  the runner's yielded messages just to log per-turn `stop_reason`.

Both call the free [Open-Meteo](https://open-meteo.com/) geocoding + forecast APIs (no API key)
for the actual weather lookup — only the Claude side needs `ANTHROPIC_API_KEY`.

### Model choice

The two halves of the repo intentionally use different models: the chat widget
(`lib/anthropic.ts`) uses `claude-haiku-4-5`; the weather agent scripts use `claude-opus-5`. This
is not an inconsistency to "fix" — change each independently if asked.
