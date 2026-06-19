// Faqat suhbatga mos, fikrlashni "dump" qilmaydigan modellar (reasoning model EMAS)
// google/gemma-4-31b-it:free — tasdiqlangan, toza o'zbek tilida javob beradi
const AI_MODELS = [
  "google/gemma-4-31b-it:free",
  "nex-agi/nex-n2-pro:free",
  "openai/gpt-oss-120b:free",
  "openrouter/free",
  "google/gemma-4-26b-a4b-it:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "meta-llama/llama-3.3-70b-instruct:free"
];

// <think> kabi teglar bilan o'ralgan fikrlashni olib tashlaydi
function stripReasoning(text) {
  if (!text) return "";
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "")
    .replace(/<reflection>[\s\S]*?<\/reflection>/gi, "")
    .replace(/<\|.*?\|>/g, "")
    .trim();
}

// Javob — fikrlash "dump"imi yoki haqiqiy javobmi? (model o'z fikrini matn sifatida chiqarsa)
function looksLikeReasoning(text) {
  if (!text || text.trim().length < 2) return true;
  const t = text.toLowerCase();
  const flags = [
    "let's tackle", "step by step", "the user", "i need to follow",
    "according to the rules", "according to the protocol", "looking at their",
    "the system message", "the system prompt", "first, i ", "first, we ",
    "let me ", "i should ", "we should ", "their main goal", "wait,",
    "let's check", "but let's", "let's see", "okay, let", "alright, let",
    "big frog (the", "their pending", "per youtube", "their current status"
  ];
  let hits = 0;
  for (const f of flags) { if (t.includes(f)) hits++; }
  return hits >= 2;
}

// Javob "axlat"mi? (bir xil so'z/ibora takrorlanib ketsa — buzuq model)
function looksLikeGarbage(text) {
  if (!text || text.trim().length < 2) return true;
  const words = text.toLowerCase().replace(/[^\p{L}\s]/gu, " ").split(/\s+/).filter(Boolean);
  if (words.length > 18) {
    const freq = {};
    let max = 0;
    for (const w of words) { if (w.length > 3) { freq[w] = (freq[w] || 0) + 1; if (freq[w] > max) max = freq[w]; } }
    if (max / words.length > 0.15) return true; // bitta so'z 15%+ takrorlansa
  }
  // 3 so'zli ketma-ketlik 3+ marta takrorlansa — axlat
  const seqs = {};
  for (let i = 0; i + 3 <= words.length; i++) {
    const s = words.slice(i, i + 3).join(" ");
    seqs[s] = (seqs[s] || 0) + 1;
    if (seqs[s] >= 3) return true;
  }
  return false;
}

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
        body: JSON.stringify({
          model: m,
          max_tokens: max_tokens || 800,
          temperature: 0.6,
          messages: fullMessages,
        }),
      });
      const data = await response.json();
      const raw = data.choices?.[0]?.message?.content;
      if (response.ok && raw) {
        const clean = stripReasoning(raw);
        // Agar javob fikrlash "dump"i yoki axlat bo'lsa — keyingi modelga o't
        if (looksLikeReasoning(clean)) {
          errors.push(m + ": reasoning-dump (skip)");
          continue;
        }
        if (looksLikeGarbage(clean)) {
          errors.push(m + ": garbage (skip)");
          continue;
        }
        return res.status(200).json({ text: clean, model: m });
      }
      errors.push(m + ": " + (data.error?.message || response.status));
    } catch (e) {
      errors.push(m + ": " + e.message);
    }
  }

  return res.status(503).json({ error: "Barcha modellar band", details: errors });
};
