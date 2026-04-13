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

// Identificador para o seu modelo atual em 2026
const GEMINI_MODEL = "gemini-3-flash"; 
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent`;

const normalizeToGemini = (messages: Message[]) => {
  return messages.map(msg => {
    const role = msg.role === "assistant" ? "model" : "user";
    let text = "";

    if (Array.isArray(msg.content)) {
      text = msg.content
        .map(part => (typeof part === "string" ? part : part.text || ""))
        .join("\n");
    } else {
      text = typeof msg.content === "string" ? msg.content : msg.content.text || "";
    }

    return {
      role: role,
      parts: [{ text: text }]
    };
  });
};

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const apiKey = process.env.GOOGLE_API_KEY || ENV.forgeApiKey;

  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY não configurada no Render.");
  }

  const isJson = params.responseFormat?.type === "json_object" || params.responseFormat?.type === "json_schema";

  const payload = {
    contents: normalizeToGemini(params.messages),
    generation_config: {
      temperature: 0.2,
      max_output_tokens: params.maxTokens || 8192,
      // O ajuste vital: snake_case para a API do Google
      response_mime_type: isJson ? "application/json" : "text/plain",
    }
  };

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Erro na API: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  return {
    id: `gemini3-${Date.now()}`,
    choices: [{
      message: { role: "assistant", content },
      finish_reason: "stop"
    }]
  };
}
