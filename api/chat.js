const AI_MODELS = [
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nex-agi/nex-n2-pro:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "openrouter/owl-alpha",
  "poolside/laguna-m.1:free",
  "cohere/north-mini-code:free"
];

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key configured emas" });

  const { messages, system, model, max_tokens } = req.body || {};
  if (!messages) return res.status(400).json({ error: "messages majburiy" });

  const fullMessages = system
    ? [{ role: "system", content: system }, ...messages]
    : messages;

  const modelsToTry = model ? [model] : AI_MODELS;
  const errors = [];

  for (const m of modelsToTry) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + apiKey,
          "HTTP-Referer": "https://kunlik-tracker.vercel.app",
          "X-Title": "Kunlik Tracker",
        },
        body: JSON.stringify({ model: m, max_tokens: max_tokens || 800, messages: fullMessages }),
      });
      const data = await response.json();
      if (response.ok && data.choices?.[0]?.message?.content) {
        return res.status(200).json({ text: data.choices[0].message.content, model: m });
      }
      errors.push(m + ": " + (data.error?.message || response.status));
    } catch (e) {
      errors.push(m + ": " + e.message);
    }
  }

  return res.status(503).json({ error: "Barcha modellar band", details: errors });
};
