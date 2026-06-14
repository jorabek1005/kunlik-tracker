const https = require("https");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const AI_MODELS = [
  "openai/gpt-oss-20b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "google/gemini-2.0-flash-lite-001:free",
  "microsoft/phi-3-medium-128k-instruct:free"
];

function httpsPost(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function callModel(apiKey, model, messages, maxTokens) {
  const payload = JSON.stringify({ model, max_tokens: maxTokens || 500, messages });
  const options = {
    hostname: "openrouter.ai",
    path: "/api/v1/chat/completions",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
      "Authorization": "Bearer " + apiKey,
      "HTTP-Referer": "https://kunlik-tracker.netlify.app",
      "X-Title": "Kunlik Tracker",
    },
  };
  return httpsPost(options, payload);
}

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "API key not configured" }) };
  }

  let parsed;
  try { parsed = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const { messages, system, model, max_tokens } = parsed;
  if (!messages) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "messages majburiy" }) };
  }

  const fullMessages = system
    ? [{ role: "system", content: system }, ...messages]
    : messages;

  // If specific model requested, use it; otherwise try fallback chain
  const modelsToTry = model ? [model] : AI_MODELS;
  const errors = [];

  for (const m of modelsToTry) {
    try {
      const result = await callModel(apiKey, m, fullMessages, max_tokens);
      const data = JSON.parse(result.body);
      if (result.status === 200 && data.choices?.[0]?.message?.content) {
        const text = data.choices[0].message.content;
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ text, model: m }) };
      }
      errors.push(m + ": " + (data.error?.message || result.status));
    } catch (e) {
      errors.push(m + ": " + e.message);
    }
  }

  return {
    statusCode: 503,
    headers: CORS,
    body: JSON.stringify({ error: "Barcha modellar band", details: errors }),
  };
};
