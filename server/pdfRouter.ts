import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const assertApiKey = () => {
  if (!process.env.GOOGLE_API_KEY) {
    throw new Error("GOOGLE_API_KEY is not configured");
  }
};

const toGeminiRole = (role: Role): "user" | "model" => {
  if (role === "assistant") return "model";
  if (role === "user") return "user";
  // For other roles like 'system', 'tool', 'function', we'll treat them as 'user' for simplicity
  // as Gemini's API primarily supports 'user' and 'model' for direct conversation turns.
  return "user";
};

const normalizeGeminiContent = (content: MessageContent | MessageContent[]) => {
  const parts: Array<{ text: string }> = [];
  const contentArray = Array.isArray(content) ? content : [content];

  for (const part of contentArray) {
    if (typeof part === "string") {
      parts.push({ text: part });
    } else if (part.type === "text") {
      parts.push({ text: part.text });
    } else {
      // Ignoring image_url and file_url for now as per strict payload requirement for text-only
      // and the specified endpoint is for generateContent (text-focused).
      // A more robust solution would handle multimodal content if the endpoint supports it.
      console.warn(`Unsupported content type encountered: ${part.type}. Skipping.`);
    }
  }
  return parts;
};

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  assertApiKey();

  const apiKey = process.env.GOOGLE_API_KEY;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const geminiMessages = params.messages.map(message => ({
    role: toGeminiRole(message.role),
    parts: normalizeGeminiContent(message.content),
  }));

  const payload = {
    contents: geminiMessages,
    // generationConfig: {
    //   maxOutputTokens: params.maxTokens || params.max_tokens || undefined,
    // },
    // The prompt explicitly asked for a specific payload structure, so other fields are omitted.
    // If tool use or other generation configurations are needed, they would be added here
    // following Gemini's API documentation.
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Gemini API invoke failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  const result = await response.json();

  // Map Gemini's response format back to InvokeResult
  const invokeResult: InvokeResult = {
    id: `gemini-${Date.now()}`,
    created: Math.floor(Date.now() / 1000),
    model: "gemini-1.5-flash",
    choices: result.candidates.map((candidate: any, index: number) => ({
      index: index,
      message: {
        role: "assistant", // Gemini's response role is typically 'model', mapping to 'assistant'
        content: candidate.content.parts.map((part: any) => part.text).join("\n"),
      },
      finish_reason: candidate.finishReason || null,
    })),
    usage: {
      prompt_tokens: result.usageMetadata?.promptTokenCount || 0,
      completion_tokens: result.usageMetadata?.candidatesTokenCount || 0,
      total_tokens: (result.usageMetadata?.promptTokenCount || 0) + (result.usageMetadata?.candidatesTokenCount || 0),
    },
  };

  return invokeResult;
}
