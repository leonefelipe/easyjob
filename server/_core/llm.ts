import { ENV } from "./env";

// --- Tipagens para manter a compatibilidade com seu projeto ---
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

// --- Configuração Google Gemini 3 ---
// Atualizado para o modelo correto de 2026
const GEMINI_MODEL = "gemini-3-flash"; 
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent`;

/**
 * Normaliza as mensagens para o formato do Google Gemini 3
 */
const normalizeToGemini = (messages: Message[]) => {
  return messages.map(msg => {
    // Gemini usa 'model' em vez de 'assistant'
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
  // Busca a chave no ambiente do Render
  const apiKey = process.env.GOOGLE_API_KEY || ENV.forgeApiKey;

  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY não encontrada. Verifique as variáveis de ambiente no Render.");
  }

  const isJson = params.responseFormat?.type === "json_object" || params.responseFormat?.type === "json_schema";

  const payload = {
    contents: normalizeToGemini(params.messages),
    generationConfig: {
      temperature: 0.2, // Um pouco mais baixo para evitar alucinações na análise
      maxOutputTokens: params.maxTokens || 8192,
      // Se o seu sistema espera JSON, o Gemini 3 Flash entrega nativamente
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
    throw new Error(`Erro na API do Gemini: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  
  // Extração do conteúdo da resposta
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  return {
    id: `gemini3-${Date.now()}`,
    choices: [{
      message: { role: "assistant", content },
      finish_reason: "stop"
    }]
  };
}
