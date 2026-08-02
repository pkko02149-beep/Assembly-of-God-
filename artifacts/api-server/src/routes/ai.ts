import { Router } from "express";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import { requireAuth } from "../lib/auth-middleware";
import { logger } from "../lib/logger";
import { getSetting, setSetting } from "./settings";

const router = Router();

const SECRET = process.env.SESSION_SECRET || "fallback-school-ai-secret";
const KEY = scryptSync(SECRET, "school-ai-salt-v1", 32);

function encrypt(text: string): string {
  if (!text) return "";
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decrypt(text: string): string {
  if (!text) return "";
  try {
    const parts = text.split(":");
    if (parts.length < 2) return "";
    const iv = Buffer.from(parts[0], "hex");
    const encrypted = Buffer.from(parts.slice(1).join(":"), "hex");
    const decipher = createDecipheriv("aes-256-cbc", KEY, iv);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

const CONFIGS = ["general", "teacher", "student"] as const;
type ConfigId = (typeof CONFIGS)[number];

const CONFIG_FOR_ROLE: Record<string, ConfigId> = {
  admin: "general",
  teacher: "teacher",
  parent: "student",
};

const DEFAULT_SYSTEM_PROMPTS: Record<string, string> = {
  admin:
    "You are an AI assistant for a school administrator. Help professionally with notices, circulars, letters, school announcements, and general school management tasks. Be concise and formal.",
  teacher:
    "You are an AI assistant for a school teacher. Help create lesson plans, homework assignments, question papers, MCQs, worksheets, and classroom activities. Be educational, structured, and practical.",
  parent:
    "You are an AI assistant for students and parents. Help with homework explanations, chapter summaries, practice questions, revision notes, attendance queries, fee queries, report card explanations, and school information. Be friendly, clear, and age-appropriate.",
};

const DEFAULT_MODEL = "llama-3.3-70b-versatile";
const GROQ_API_BASE = "https://api.groq.com/openai/v1";

async function getAiConfig(configId: ConfigId) {
  const [enabled, encryptedKey, model, temperature, maxTokens] = await Promise.all([
    getSetting(`ai_${configId}_enabled`),
    getSetting(`ai_${configId}_key`),
    getSetting(`ai_${configId}_model`),
    getSetting(`ai_${configId}_temperature`),
    getSetting(`ai_${configId}_max_tokens`),
  ]);
  return {
    enabled: enabled === "true",
    apiKey: decrypt(encryptedKey),
    model: model || DEFAULT_MODEL,
    temperature: parseFloat(temperature || "0.7"),
    maxTokens: parseInt(maxTokens || "2048", 10),
  };
}

/** Convert Groq/OpenAI error response into a user-friendly string */
function friendlyGroqError(status: number, rawMsg: string): string {
  const lower = rawMsg.toLowerCase();
  if (status === 401 || lower.includes("invalid api key") || lower.includes("authentication")) {
    return "Invalid Groq API key. Please check the key in Admin → Settings → AI Settings.";
  }
  if (status === 429 || lower.includes("rate limit") || lower.includes("quota")) {
    return "Rate limit reached for this Groq API key. Please wait a moment and try again, or switch to a faster model (e.g. llama-3.1-8b-instant) in AI Settings.";
  }
  if (status === 404 || lower.includes("model not found") || lower.includes("does not exist")) {
    return "The selected model is not available. Please choose a different model in AI Settings.";
  }
  if (status === 403) {
    return "Access denied. Please verify your Groq API key has the required permissions.";
  }
  return rawMsg || `Groq API error (HTTP ${status})`;
}

// ─── GET /settings/ai/:configId — admin only ────────────────────────────────
router.get("/settings/ai/:configId", requireAuth("admin"), async (req, res) => {
  const configId = req.params.configId as ConfigId;
  if (!CONFIGS.includes(configId)) return res.status(400).json({ error: "Invalid config ID" });

  try {
    const config = await getAiConfig(configId);
    res.json({
      enabled: config.enabled,
      apiKey: config.apiKey ? "••••••••" : "",
      hasKey: !!config.apiKey,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    });
  } catch (err) {
    logger.error({ err }, "Failed to get AI config");
    res.status(500).json({ error: "Failed to load AI settings" });
  }
});

// ─── POST /settings/ai/:configId — admin only ───────────────────────────────
router.post("/settings/ai/:configId", requireAuth("admin"), async (req, res) => {
  const configId = req.params.configId as ConfigId;
  if (!CONFIGS.includes(configId)) return res.status(400).json({ error: "Invalid config ID" });

  const { enabled, apiKey, model, temperature, maxTokens } = req.body as {
    enabled?: boolean;
    apiKey?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };

  try {
    const saves: Promise<void>[] = [
      setSetting(`ai_${configId}_enabled`, enabled ? "true" : "false"),
      setSetting(`ai_${configId}_model`, model?.trim() || DEFAULT_MODEL),
      setSetting(`ai_${configId}_temperature`, String(Math.min(Math.max(temperature ?? 0.7, 0), 2))),
      setSetting(`ai_${configId}_max_tokens`, String(Math.min(maxTokens ?? 2048, 8192))),
    ];

    if (apiKey && !apiKey.startsWith("••")) {
      saves.push(setSetting(`ai_${configId}_key`, encrypt(apiKey.trim())));
    }

    await Promise.all(saves);
    logger.info({ configId }, "AI config updated");
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to save AI config");
    res.status(500).json({ error: "Failed to save AI settings" });
  }
});

// ─── POST /settings/ai/:configId/validate ───────────────────────────────────
router.post("/settings/ai/:configId/validate", requireAuth("admin"), async (req, res) => {
  const configId = req.params.configId as ConfigId;
  if (!CONFIGS.includes(configId)) return res.status(400).json({ error: "Invalid config ID" });

  try {
    const config = await getAiConfig(configId);
    const testKey =
      req.body.apiKey && !String(req.body.apiKey).startsWith("••")
        ? String(req.body.apiKey).trim()
        : config.apiKey;
    const testModel = req.body.model?.trim() || config.model || DEFAULT_MODEL;

    if (!testKey) return res.json({ ok: false, message: "No API key provided" });

    const testRes = await fetch(`${GROQ_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${testKey}`,
      },
      body: JSON.stringify({
        model: testModel,
        messages: [{ role: "user", content: "Say: OK" }],
        max_tokens: 5,
      }),
    });

    if (testRes.ok) {
      res.json({ ok: true, message: "✅ API key is valid and working" });
    } else {
      const errData = await testRes.json().catch(() => ({}));
      const raw: string = (errData as any)?.error?.message || `HTTP ${testRes.status}`;
      const msg = friendlyGroqError(testRes.status, raw);
      res.json({ ok: false, message: `❌ ${msg}` });
    }
  } catch (err: any) {
    res.json({ ok: false, message: `❌ Connection failed: ${err.message}` });
  }
});

// ─── POST /ai/chat — any authenticated user ─────────────────────────────────
router.post("/ai/chat", requireAuth("admin", "teacher", "parent"), async (req, res) => {
  const user = (req as any).user as { id: number; role: "admin" | "teacher" | "parent" };
  const configId = CONFIG_FOR_ROLE[user.role] || "general";

  try {
    const config = await getAiConfig(configId);

    if (!config.enabled) {
      return res.status(403).json({ error: "AI assistant is not enabled for your role. Ask the administrator to enable it in AI Settings." });
    }
    if (!config.apiKey) {
      return res.status(503).json({ error: "AI is not configured. Please ask the administrator to set up the Groq API key in AI Settings." });
    }

    // Messages come in as OpenAI format: { role: "user"|"assistant", content: string }
    const { messages, systemPrompt } = req.body as {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
      systemPrompt?: string;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array is required" });
    }

    const finalSystemPrompt = systemPrompt || DEFAULT_SYSTEM_PROMPTS[user.role] || DEFAULT_SYSTEM_PROMPTS.admin;

    const groqRes = await fetch(`${GROQ_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: finalSystemPrompt },
          ...messages,
        ],
        temperature: Math.min(config.temperature, 2),
        max_tokens: Math.min(config.maxTokens, 8192),
      }),
    });

    if (!groqRes.ok) {
      const errData = await groqRes.json().catch(() => ({}));
      const rawMsg: string = (errData as any)?.error?.message || "";
      logger.warn({ status: groqRes.status, configId, role: user.role }, "Groq API error");
      return res.status(502).json({ error: friendlyGroqError(groqRes.status, rawMsg) });
    }

    const data = (await groqRes.json()) as any;
    const text: string = data.choices?.[0]?.message?.content || "";
    res.json({ text });
  } catch (err: any) {
    logger.error({ err, configId }, "AI chat error");
    res.status(500).json({ error: "Failed to reach Groq AI service. Please check your internet connection." });
  }
});

// ─── POST /ai/generate-homework — teacher or admin only ─────────────────────
router.post("/ai/generate-homework", requireAuth("admin", "teacher"), async (req, res) => {
  const user = (req as any).user as { id: number; role: "admin" | "teacher" };
  const configId: ConfigId = user.role === "admin" ? "general" : "teacher";

  try {
    const config = await getAiConfig(configId);

    if (!config.enabled || !config.apiKey) {
      return res.status(503).json({
        error: "Teacher AI is not configured. Ask the administrator to set up the Groq API key in AI Settings → Teacher AI.",
      });
    }

    const { className, sectionName, subject, chapter, difficulty } = req.body as {
      className: string;
      sectionName?: string | null;
      subject: string;
      chapter?: string;
      difficulty?: string;
    };

    if (!className || !subject) {
      return res.status(400).json({ error: "className and subject are required" });
    }

    const prompt = `Generate a homework assignment for school students with these details:
- Class: ${className}${sectionName ? ` - Section ${sectionName}` : ""}
- Subject: ${subject}
${chapter ? `- Chapter/Topic: ${chapter}` : ""}
${difficulty ? `- Difficulty Level: ${difficulty}` : "- Difficulty Level: Medium"}

Create a clear, structured homework description that a teacher can directly assign to students. Include:
1. A brief task introduction (1-2 sentences)
2. Specific questions or exercises (3-5 items numbered clearly)
3. Any special instructions if needed

Keep it appropriate and concise. Return only the homework description text without any markdown formatting like ** or ##. Use plain text with numbered lists only.`;

    const groqRes = await fetch(`${GROQ_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "system",
            content: "You are a helpful school teacher assistant. Generate practical, age-appropriate homework assignments. Return plain text only, no markdown formatting.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!groqRes.ok) {
      const errData = await groqRes.json().catch(() => ({}));
      const rawMsg: string = (errData as any)?.error?.message || "";
      return res.status(502).json({ error: friendlyGroqError(groqRes.status, rawMsg) });
    }

    const data = (await groqRes.json()) as any;
    const text: string = data.choices?.[0]?.message?.content || "";
    res.json({ text });
  } catch (err: any) {
    logger.error({ err }, "Homework AI generation error");
    res.status(500).json({ error: "Failed to generate homework content" });
  }
});

// ─── POST /ai/translate — translate text between English and Hindi ────────────
router.post("/ai/translate", requireAuth("admin", "teacher"), async (req, res) => {
  const user = (req as any).user as { id: number; role: "admin" | "teacher" };
  const configId: ConfigId = user.role === "admin" ? "general" : "teacher";

  try {
    const config = await getAiConfig(configId);

    if (!config.enabled || !config.apiKey) {
      // Fallback: return the original text if AI not configured
      return res.json({ text: req.body.text || "" });
    }

    const { text, targetLang } = req.body as { text: string; targetLang: "hi" | "en" };
    if (!text) return res.json({ text: "" });

    const langName = targetLang === "hi" ? "Hindi (Devanagari script)" : "English";
    const prompt = `Translate the following school homework text to ${langName}. Return ONLY the translated text, nothing else, no explanations, no quotation marks.\n\nText: ${text}`;

    const groqRes = await fetch(`${GROQ_API_BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: "You are a precise translator for school homework content. Translate accurately and return only the translated text." },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 512,
      }),
    });

    if (!groqRes.ok) {
      return res.json({ text: req.body.text || "" });
    }

    const data = (await groqRes.json()) as any;
    const translated: string = data.choices?.[0]?.message?.content?.trim() || text;
    return res.json({ text: translated });
  } catch {
    return res.json({ text: req.body.text || "" });
  }
});

export default router;
