import { ENV } from "./env";

// --- Tipagens originais mantidas para compatibilidade ---
export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = { type: "text"; text: string };
export type ImageContent = { type: "image_url"; image_url: { url: string } };
export type FileContent = { type: "file_url"; file_url: { url: string; mime_type?: string } };

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
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

// --- Configuração Google Gemini ---
const GEMINI_MODEL = "gemini-1.5-flash";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Converte o formato de mensagens do OpenAI/tRPC para o formato do Google Gemini
 * Gemini usa 'user' e 'model' em vez de 'user' e 'assistant'
 */
const normalizeToGemini = (messages: Message[]) => {
  return messages.map(msg => {
    const role = msg.role === "assistant" ? "model" : "user";
    let text = "";

    if (Array.isArray(msg.content)) {
      text = msg.content
        .map(part => (typeof part === "string" ? part : (part as TextContent).text || ""))
        .join("\n");
    } else {
      text = typeof msg.content === "string" ? msg.content : (msg.content as TextContent).text;
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
    throw new Error("GOOGLE_API_KEY não configurada no ambiente do Render.");
  }

  const isJson = params.responseFormat?.type === "json_object" || params.responseFormat?.type === "json_schema";

  const payload = {
    contents: normalizeToGemini(params.messages),
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: params.maxTokens || 8192,
      responseMimeType: isJson ? "application/json" : "text/plain",
    }
  };

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API Error: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  
  // Extrai o texto da resposta do Gemini
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  return {
    id: `gemini-${Date.now()}`,
    choices: [{
      message: { role: "assistant", content },
      finish_reason: "stop"
    }]
  };
}
