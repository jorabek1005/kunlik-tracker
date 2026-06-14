module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key configured emas" });

  const { messages, system } = req.body || {};
  if (!messages) return res.status(400).json({ error: "messages majburiy" });

  const fullMessages = system
    ? [{ role: "system", content: system }, ...messages]
    : messages;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey,
        "HTTP-Referer": "https://kunlik-tracker.netlify.app",
        "X-Title": "Kunlik Tracker - Ustoz",
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-r1:free",
        max_tokens: 1000,
        messages: fullMessages,
      }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);

    const text = data.choices?.[0]?.message?.content || "Xatolik yuz berdi.";
    return res.status(200).json({ content: [{ type: "text", text }] });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
