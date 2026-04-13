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
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4";
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

// ─── Groq config ─────────────────────────────────────────────────────────────
// Model: llama-3.3-70b-versatile — free, fast, 128k context
// Groq suporta response_format: { type: "json_object" } mas NÃO json_schema strict.
// Convertemos json_schema → json_object (o prompt já instrui a IA a retornar JSON válido).

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.1-8b-instant";

const assertApiKey = () => {
  if (!ENV.forgeApiKey) {
    throw new Error(
      "GROQ_API_KEY não configurada. Adicione a variável de ambiente GROQ_API_KEY no Render."
    );
  }
};

// ─── Normalizers ──────────────────────────────────────────────────────────────

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") return { type: "text", text: part };
  if (part.type === "text") return part;
  if (part.type === "image_url") return part;
  if (part.type === "file_url") return part;
  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");
    return { role, name, tool_call_id, content };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // Groq prefere string simples quando há só texto
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return { role, name, content: (contentParts[0] as TextContent).text };
  }

  // Groq não suporta image_url / file_url — extrai apenas texto
  const textOnly = contentParts
    .filter((p): p is TextContent => p.type === "text")
    .map(p => p.text)
    .join("\n");

  return { role, name, content: textOnly };
};

// Groq suporta json_object mas não json_schema strict.
// Convertemos qualquer json_schema para json_object — o system prompt já garante a estrutura.
const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}): { type: "json_object" } | undefined => {
  const fmt = responseFormat || response_format;
  if (fmt) {
    if (fmt.type === "json_schema" || fmt.type === "json_object") {
      return { type: "json_object" };
    }
    return undefined; // type: "text"
  }

  const schema = outputSchema || output_schema;
  if (schema) return { type: "json_object" };

  return undefined;
};

// ─── Main export ──────────────────────────────────────────────────────────────

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  assertApiKey();

  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
  } = params;

  const payload: Record<string, unknown> = {
    model: GROQ_MODEL,
    messages: messages.map(normalizeMessage),
    max_tokens: 8192, // Groq free: max 8192 output tokens no llama-3.3-70b
    temperature: 0.3,  // Mais determinístico para análise estruturada
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;

    const tc = toolChoice || tool_choice;
    if (tc && tc !== "required") {
      payload.tool_choice = tc;
    } else if (tc === "required" && tools.length === 1) {
      payload.tool_choice = {
        type: "function",
        function: { name: tools[0].function.name },
      };
    }
  }

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  return (await response.json()) as InvokeResult;
}
