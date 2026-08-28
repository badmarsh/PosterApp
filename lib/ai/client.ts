import { ZodSchema } from "zod"
import { AIProviderError, AIValidationError } from "./errors"
import { parseAiJson } from "@/lib/ai-helpers"

interface AIClientOptions<T> {
  model: string;
  systemPrompt?: string;
  userPrompt: string | any[];
  schema: ZodSchema<T>;
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Shared boundary for interacting with the AI provider.
 * Normalizes requests, enforces schemas, logs safely, and handles errors.
 */
export async function generateAIResponse<T>(
  operationName: string,
  options: AIClientOptions<T>
): Promise<T> {
  const apiUrl = process.env.AI_API_URL;
  const apiKey = process.env.AI_API_KEY;

  if (!apiUrl || !apiKey) {
    throw new Error("AI API configuration missing (AI_API_URL or AI_API_KEY)");
  }

  const messages: any[] = [];
  if (options.systemPrompt) {
    messages.push({ role: "system", content: options.systemPrompt });
  }
  
  // If the user prompt is an array (e.g. for vision), use it directly
  if (Array.isArray(options.userPrompt)) {
    messages.push({ role: "user", content: options.userPrompt });
  } else {
    messages.push({ role: "user", content: options.userPrompt });
  }

  const payload = {
    model: options.model,
    messages,
    response_format: { type: "json_object" },
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens,
  };

  const startTime = Date.now();

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: options.signal
    });

    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      let errText = response.statusText;
      try {
        errText = await response.text();
      } catch (e) {
        // Ignore
      }
      console.error(`[AI ${operationName}] Provider failed: HTTP ${response.status} (${durationMs}ms)`);
      throw new AIProviderError(response.status, `AI API failed: HTTP ${response.status}`);
    }

    const data = await response.json();
    
    // Log structured usage without exposing prompts or raw text
    console.log(`[AI ${operationName}] Success. Model: ${options.model}, Duration: ${durationMs}ms, Tokens: ${data.usage?.total_tokens ?? 'unknown'}`);

    if (!data.choices?.length) {
      throw new Error("AI returned no choices — possible rate limit or safety block");
    }

    const content = data.choices[0].message?.content;
    if (!content) {
      throw new Error("Empty response from AI");
    }

    const { data: parsed, error } = parseAiJson(content);
    if (error) {
      throw new AIValidationError("AI returned malformed JSON");
    }

    const validationResult = options.schema.safeParse(parsed);
    if (!validationResult.success) {
      console.error(`[AI ${operationName}] Schema validation failed`, validationResult.error.format());
      throw new AIValidationError("AI returned JSON that does not match the expected schema");
    }

    return validationResult.data;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`[AI ${operationName}] Request aborted`);
      throw error;
    }
    
    if (error instanceof AIProviderError || error instanceof AIValidationError) {
      throw error;
    }

    const durationMs = Date.now() - startTime;
    console.error(`[AI ${operationName}] Unhandled error (${durationMs}ms):`, error instanceof Error ? error.message : String(error));
    throw new Error(`AI operation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

export async function generateAITextResponse(
  operationName: string,
  options: Omit<AIClientOptions<any>, "schema">
): Promise<string> {
  const apiUrl = process.env.AI_API_URL;
  const apiKey = process.env.AI_API_KEY;

  if (!apiUrl || !apiKey) {
    throw new Error("AI API configuration missing (AI_API_URL or AI_API_KEY)");
  }

  const messages: any[] = [];
  if (options.systemPrompt) {
    messages.push({ role: "system", content: options.systemPrompt });
  }
  
  if (Array.isArray(options.userPrompt)) {
    messages.push(...options.userPrompt);
  } else {
    messages.push({ role: "user", content: options.userPrompt });
  }

  const payload = {
    model: options.model,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens,
  };

  const startTime = Date.now();

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: options.signal
    });

    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      let errText = response.statusText;
      try { errText = await response.text(); } catch (e) {}
      console.error(`[AI ${operationName}] Provider failed: HTTP ${response.status} (${durationMs}ms)`);
      throw new AIProviderError(response.status, `AI API failed: HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log(`[AI ${operationName}] Success. Model: ${options.model}, Duration: ${durationMs}ms, Tokens: ${data.usage?.total_tokens ?? 'unknown'}`);

    if (!data.choices?.length) {
      throw new Error("AI returned no choices — possible rate limit or safety block");
    }

    const content = data.choices[0].message?.content;
    if (!content) {
      throw new Error("Empty response from AI");
    }

    return content;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`[AI ${operationName}] Request aborted`);
      throw error;
    }
    const durationMs = Date.now() - startTime;
    console.error(`[AI ${operationName}] Unhandled error (${durationMs}ms):`, error instanceof Error ? error.message : String(error));
    throw new Error(`AI operation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
