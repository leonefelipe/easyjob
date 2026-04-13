import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type Message = {
  role: Role;
  content: string | any;
  name?: string;
};

export type InvokeParams = {
  messages: Message[];
  maxTokens?: number;
  responseFormat?: { type: "text" | "json_object" | "json_schema" };
};

export type InvokeResult = {
  id: string;
  choices: Array<{
    message: { role: Role; content: string };
    finish_reason: string;
  }>;
};

// URL Oficial do Google Gemini (Sem Proxy do Manus)
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

const normalizeToGemini = (messages: Message[]) => {
  return messages.map(msg => {
    const role = msg.role === "assistant" ? "model" : "user";
    let text = typeof msg.content === "string" 
      ? msg.content 
      : Array.isArray(msg.content) 
        ? msg.content.map(p => p.text || "").join("\n") 
        : msg.content.text || "";

    return { role, parts: [{ text }] };
  });
};

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  // Puxa a chave da variável de ambiente do Render
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY ausente. Adicione no Environment do Render.");
  }

  const payload = {
    contents: normalizeToGemini(params.messages),
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: params.maxTokens || 8192
    }
  };

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Erro na API do Google: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  return {
    id: `gemini-${Date.now()}`,
    choices: [{
      message: { role: "assistant", content },
      finish_reason: "stop"
    }]
  };
}
