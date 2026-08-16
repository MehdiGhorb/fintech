export type Role = 'system' | 'user' | 'assistant' | 'tool';

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface Message {
  role: Role;
  content: string;
  toolCalls?: ToolCall[];
  /** Set on `tool` messages to link the result back to its call. */
  toolCallId?: string;
  name?: string;
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  calls: number;
}

export interface CompletionRequest {
  messages: Message[];
  tools?: ToolSchema[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Ask the model for a JSON object matching this shape (best effort per provider). */
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  signal?: AbortSignal;
}

export interface CompletionResponse {
  text: string;
  toolCalls: ToolCall[];
  usage: Usage;
  stopReason?: string;
  model: string;
}
