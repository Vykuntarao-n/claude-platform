/**
 * A minimal agent loop: Claude decides when to call a get_weather tool,
 * we execute it against a real (free, no-key) weather API, and feed the
 * result back until Claude has enough to answer in plain language.
 *
 * Run: npm run weather -- "Paris" (or with no arg, it will prompt you)
 */
import Anthropic from "@anthropic-ai/sdk";
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

// The tool's actual implementation - runs on our side, not on Anthropic's servers.
async function getWeather(location: string): Promise<string> {
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

// Claude only sees this description + schema - it decides when to call the
// tool and what "location" to pass based on this contract.
const weatherTool: Anthropic.Tool = {
  name: "get_weather",
  description:
    "Get current weather conditions (temperature, humidity, wind, conditions) for a city " +
    "or place name. Always call this instead of guessing - you have no built-in real-time weather data.",
  input_schema: {
    type: "object",
    properties: {
      location: {
        type: "string",
        description: "City name, optionally with state/country, e.g. 'Austin, TX' or 'Tokyo, Japan'.",
      },
    },
    required: ["location"],
  },
};

async function runAgentLoop(userQuestion: string) {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userQuestion }];
  console.log(`\n[Step 1] User -> Claude: "${userQuestion}"`);

  const MAX_TURNS = 5;
  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    console.log(`\n[Step ${turn === 1 ? 2 : "loop"}] Sending ${messages.length} message(s) to Claude (turn ${turn})...`);

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system:
        "You are a weather assistant. When asked about weather, always call the get_weather " +
        "tool rather than guessing - you have no built-in weather knowledge. Once you have the " +
        "tool result, answer conversationally in 1-3 sentences.",
      tools: [weatherTool],
      messages,
    });

    console.log(`   Claude's stop_reason: "${response.stop_reason}"`);

    if (response.stop_reason !== "tool_use") {
      // Claude decided it has everything it needs - this ends the loop.
      const finalText = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      console.log(`\n[Final answer]\n${finalText}\n`);
      return;
    }

    // Claude decided it needs data it doesn't have, and asked to call a tool.
    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    for (const t of toolUses) {
      console.log(`   -> Claude's decision: call "${t.name}" with input ${JSON.stringify(t.input)}`);
    }

    // The full assistant turn (including the tool_use block) must go back
    // into history, or Claude loses track of what it asked for.
    messages.push({ role: "assistant", content: response.content });

    // Execute every requested tool call and collect results.
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUses) {
      const input = toolUse.input as { location: string };
      const result = await getWeather(input.location);
      console.log(`   <- Tool result: ${result}`);
      toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: result });
    }

    // All tool_result blocks for this turn go back in a single user message.
    messages.push({ role: "user", content: toolResults });
  }

  console.log(`Stopped after ${MAX_TURNS} turns without a final answer.`);
}

async function main() {
  const argLocation = process.argv.slice(2).join(" ").trim();
  let location = argLocation;
  if (!location) {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    location = await rl.question("Enter a location: ");
    rl.close();
  }
  await runAgentLoop(`What's the weather like in ${location}?`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
