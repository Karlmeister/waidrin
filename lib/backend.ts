import { current, isDraft } from "immer";
import * as z from "zod/v4";
import type { Prompt } from "./prompts";
import { getState } from "./state";

export type TokenCallback = (token: string, count: number) => void;

export interface Backend {
  getNarration(prompt: Prompt, onToken?: TokenCallback): Promise<string>;

  getObject<Schema extends z.ZodType, Type extends z.infer<Schema>>(
    prompt: Prompt,
    schema: Schema,
    onToken?: TokenCallback,
  ): Promise<Type>;

  abort(): void;

  isAbortError(error: unknown): boolean;
}

export interface DefaultBackendSettings {
  apiUrl: string;
  apiKey: string;
  model: string;
  generationParams: Record<string, unknown>;
  narrationParams: Record<string, unknown>;
}

export class DefaultBackend implements Backend {
  controller = new AbortController();

  getSettings(): DefaultBackendSettings {
    return getState();
  }

  async *getResponseStream(prompt: Prompt, params: Record<string, unknown> = {}): AsyncGenerator<string> {
    try {
      const settings = this.getSettings();

      const requestPayload = {
        apiUrl: settings.apiUrl,
        apiKey: settings.apiKey,
        model: settings.model,
        stream: true,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
        max_tokens: 4096,
        max_completion_tokens: 4096,
        ...params,
      };

      const response = await fetch("/api/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
        signal: this.controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Request failed" }));
        throw new Error(
          typeof errorData.error === "string" ? errorData.error : `Request failed with status ${response.status}`,
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          const data = trimmed.slice(6);
          if (data === "[DONE]") return;

          try {
            const parsed = JSON.parse(data);
            if (parsed.choices && parsed.choices.length > 0) {
              const content = parsed.choices[0].delta?.content;
              if (content) {
                yield content;
              }
              if (parsed.choices[0].finish_reason) {
                return;
              }
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }

      if (this.controller.signal.aborted) {
        throw new DOMException("The user aborted a request.", "AbortError");
      }
    } finally {
      this.controller = new AbortController();
    }
  }

  async getResponse(prompt: Prompt, params: Record<string, unknown> = {}, onToken?: TokenCallback): Promise<string> {
    const state = getState();

    if (state.logPrompts) {
      console.log(prompt.user);
    }

    if (state.logParams) {
      console.log(isDraft(params) ? current(params) : params);
    }

    let response = "";
    let count = 0;

    if (onToken) {
      onToken("", 0);
    }

    for await (const token of this.getResponseStream(prompt, params)) {
      response += token;
      count++;

      if (onToken) {
        onToken(token, count);
      }
    }

    if (state.logResponses) {
      console.log(response);
    }

    return response;
  }

  async getNarration(prompt: Prompt, onToken?: TokenCallback): Promise<string> {
    return await this.getResponse(prompt, this.getSettings().narrationParams, onToken);
  }

  async getObject<Schema extends z.ZodType, Type extends z.infer<Schema>>(
    prompt: Prompt,
    schema: Schema,
    onToken?: TokenCallback,
  ): Promise<Type> {
    const response = await this.getResponse(
      prompt,
      {
        ...this.getSettings().generationParams,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "schema",
            strict: true,
            schema: z.toJSONSchema(schema),
          },
        },
      },
      onToken,
    );

    return schema.parse(JSON.parse(response)) as Type;
  }

  abort(): void {
    this.controller.abort();
  }

  isAbortError(error: unknown): boolean {
    return error instanceof DOMException && error.name === "AbortError";
  }
}

const defaultBackend = new DefaultBackend();

export function getBackend(): Backend {
  const state = getState();
  return Object.hasOwn(state.backends, state.activeBackend) ? state.backends[state.activeBackend] : defaultBackend;
}
