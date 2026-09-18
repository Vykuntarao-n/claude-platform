/**
 * Same agent as weather-agent.ts, but using the SDK's Tool Runner
 * (client.beta.messages.toolRunner) instead of a hand-written loop.
 * The runner drives the request -> tool call -> tool result -> request
 * cycle for us; we just define the tool's schema and its `run` function.
 *
 * Run: npm run weather:runner -- "Paris" (or with no arg, it will prompt you)
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

const client = new Anthropic();
const MODEL = "claude-opus-5";

// WMO weather codes -> human-readable conditions (subset covering common cases).
const WEATHER_CODES: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  71: "Slight snow fall",
  73: "Moderate snow fall",
  75: "Heavy snow fall",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

async function fetchWeather(location: string): Promise<string> {
  const geoRes = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`,
  );
  const geo = (await geoRes.json()) as {
    results?: { name: string; latitude: number; longitude: number; country?: string; admin1?: string }[];
  };
  const place = geo.results?.[0];
  if (!place) {
    return JSON.stringify({ error: `Could not find a location matching "${location}".` });
  }

  const forecastRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
      `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code` +
      `&temperature_unit=fahrenheit&wind_speed_unit=mph`,
  );
  const forecast = (await forecastRes.json()) as {
    current: {
      temperature_2m: number;
      relative_humidity_2m: number;
      wind_speed_10m: number;
      weather_code: number;
    };
  };
  const c = forecast.current;

  return JSON.stringify({
    location: [place.name, place.admin1, place.country].filter(Boolean).join(", "),
    temperature_f: c.temperature_2m,
    humidity_percent: c.relative_humidity_2m,
    wind_mph: c.wind_speed_10m,
    conditions: WEATHER_CODES[c.weather_code] ?? `Weather code ${c.weather_code}`,
  });
}

// betaZodTool bundles the schema (auto-generated from the Zod type) with the
// function that actually runs when Claude decides to call it - the runner
// invokes this for us, so there's no manual tool_use/tool_result plumbing.
const getWeather = betaZodTool({
  name: "get_weather",
  description:
    "Get current weather conditions (temperature, humidity, wind, conditions) for a city " +
    "or place name. Always call this instead of guessing - you have no built-in real-time weather data.",
  inputSchema: z.object({
    location: z
      .string()
      .describe("City name, optionally with state/country, e.g. 'Austin, TX' or 'Tokyo, Japan'."),
  }),
  run: async ({ location }) => {
    console.log(`   -> Claude's decision: call "get_weather" with input ${JSON.stringify({ location })}`);
    const result = await fetchWeather(location);
    console.log(`   <- Tool result: ${result}`);
    return result;
  },
});

async function runAgent(userQuestion: string) {
  console.log(`\n[Step 1] User -> Claude: "${userQuestion}"`);

  const runner = client.beta.messages.toolRunner({
    model: MODEL,
    max_tokens: 1024,
    system:
      "You are a weather assistant. When asked about weather, always call the get_weather " +
      "tool rather than guessing - you have no built-in weather knowledge. Once you have the " +
      "tool result, answer conversationally in 1-3 sentences.",
    tools: [getWeather],
    messages: [{ role: "user", content: userQuestion }],
  });

  // The runner yields one message per loop turn: call the model, run any
  // requested tools, feed results back, repeat - until Claude stops asking
  // for tools. Iterating just lets us watch stop_reason turn by turn.
  let turn = 0;
  let finalMessage: Anthropic.Beta.BetaMessage | undefined;
  for await (const message of runner) {
    turn++;
    console.log(`\n[Turn ${turn}] Claude's stop_reason: "${message.stop_reason}"`);
    finalMessage = message;
  }

  const finalText = (finalMessage?.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => (b as Anthropic.Beta.BetaTextBlock).text)
    .join("\n");
  console.log(`\n[Final answer]\n${finalText}\n`);
}

async function main() {
  const argLocation = process.argv.slice(2).join(" ").trim();
  let location = argLocation;
  if (!location) {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    location = await rl.question("Enter a location: ");
    rl.close();
  }
  await runAgent(`What's the weather like in ${location}?`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
