/**
 * AG-UI client types for the Coderblock frontend.
 *
 * These are platform-side types consumed by `useAIChat` and the UI widgets.
 * They are intentionally distinct from `@ag-ui/core`'s wire-level event types
 * (which are an implementation detail of the hook): the hook aggregates the
 * stream of TEXT_MESSAGE_*, TOOL_CALL_*, STEP_*, STATE_*, REASONING_* events
 * into the higher-level structures below that map 1:1 to what the UI renders.
 *
 * If you ever need to extend the model (e.g. add rich tool-result rendering),
 * extend these types — don't expose the raw AG-UI events to the UI layer.
 */
import type { ReactNode } from 'react'

export type MessageRole = 'user' | 'assistant' | 'tool' | 'system'

export type ToolCallStatus =
  | 'streaming_args' // LLM is still emitting the JSON arguments
  | 'executing' // backend is running the tool
  | 'complete' // backend returned a result
  | 'error'

export interface ToolCall {
  id: string
  name: string
  /** Raw JSON string of the arguments. May be incomplete while `status === 'streaming_args'`. */
  args: string
  /** Parsed args — populated only once `args` is a complete JSON document. */
  parsedArgs?: Record<string, unknown>
  result?: string
  status: ToolCallStatus
  /** Message ID this tool call belongs to (the assistant reasoning message). */
  parentMessageId?: string
  /**
   * True when the tool was declared in `UseAIChatOptions.frontendTools` and must
   * therefore be resolved client-side (HITL pattern). When `render` is provided
   * on the tool spec, the hook keeps the call in `status: 'executing'` and
   * exposes the render context on `ToolCall.renderContext` — the widget layer
   * (ChatWidget / MultiAgentView) mounts the user-provided React node inline.
   */
  isFrontend?: boolean
  /** Only populated for frontend tools with a `render` callback; opaque to the hook. */
  renderContext?: FrontendToolRenderContext<Record<string, unknown>, unknown>
}

export interface Message {
  id: string
  role: MessageRole
  content: string
  /**
   * Accumulated reasoning / "thinking" content for this message (Claude extended
   * thinking, o1/o3 reasoning, R1, …). Populated from REASONING_* AG-UI events
   * emitted before the visible TEXT_MESSAGE_START; the hook concatenates deltas
   * and attaches the result to the next assistant message. Undefined when the
   * model didn't emit a reasoning trace.
   */
  reasoning?: string
  /** Present on assistant messages that trigger tool calls. */
  toolCalls?: ToolCall[]
  /** Only on role === 'tool' — the id of the tool call that produced this result. */
  toolCallId?: string
  createdAt: number
}

/**
 * Tool implementation that runs in the user's browser (Human-in-the-Loop).
 *
 * Two flavors:
 *   1. **Auto-resolve** — set `handler` only. As soon as the backend finishes
 *      emitting TOOL_CALL_END for this tool, the hook calls `handler(args)`,
 *      awaits the result, appends a `role: 'tool'` message, and posts a
 *      follow-up run so the agent can continue. No UI involved.
 *   2. **Interactive** — set `render` (optionally `handler` too). The hook
 *      keeps the tool call in `status: 'executing'` and renders the returned
 *      React node inline in the chat. The node receives a `respond(result)`
 *      callback that, when invoked, plays out the same resume-with-result
 *      dance as the auto-resolve path.
 *
 * @template TArgs - Shape of the parsed tool arguments (JSON-parsed).
 * @template TResult - Shape of the value you pass to `respond()` / return from
 *                    `handler`. Serialized to string before being sent back.
 */
export interface FrontendTool<
  TArgs extends Record<string, unknown> = Record<string, unknown>,
  TResult = unknown,
> {
  /** Natural-language description sent to the LLM. */
  description: string
  /** JSON Schema describing the tool's arguments (forwarded to the backend). */
  parameters: Record<string, unknown>
  /** Sync or async callback. Required if `render` is not provided. */
  handler?: (args: TArgs) => TResult | Promise<TResult>
  /**
   * Render a React node for the tool call. When this is set, the hook waits
   * for `respond(result)` to be called (inside your component) before
   * resuming the run. If both `render` and `handler` are set, `render` wins
   * and `handler` is ignored.
   */
  render?: (ctx: FrontendToolRenderContext<TArgs, TResult>) => ReactNode
}

export interface FrontendToolRenderContext<
  TArgs extends Record<string, unknown> = Record<string, unknown>,
  TResult = unknown,
> {
  /** Parsed arguments the LLM produced. */
  args: TArgs
  /** Current status of the tool call. */
  status: ToolCallStatus
  /** Final result — populated once `respond` has been called (or handler returned). */
  result?: TResult
  /** Call when the user has produced a result. Idempotent — subsequent calls are no-ops. */
  respond: (result: TResult) => void
  /** The backing ToolCall record (useful for debug / logging). */
  toolCall: ToolCall
}

export interface AgentStep {
  name: string
  startedAt: number
  finishedAt?: number
  /** Derived: `finishedAt ? 'done' : 'running'` */
  status: 'running' | 'done'
}

export interface RunInput {
  /** Primary path: a plain text message from the user. */
  message?: string
  /**
   * Advanced path: pass the full message array (for programmatic scenarios
   * like "replay this conversation"). Mutually exclusive with `message`.
   */
  messages?: Message[]
  /** Tools the backend agent can call. Optional. */
  tools?: Array<{
    name: string
    description: string
    parameters: Record<string, unknown>
  }>
  /** Additional context keys/values the backend may consume. */
  context?: Array<{ description: string; value: string }>
}

export interface UseAIChatOptions {
  /** Backend endpoint, e.g. `/api/chat` or `/api/multi_agent/run`. */
  endpoint: string
  /**
   * Persistent thread ID. If omitted, a fresh UUID is generated on mount
   * and stable for the component's lifetime. Pass your own when you want
   * to resume an existing conversation (e.g. loaded from DB).
   */
  threadId?: string
  /** Initial messages, e.g. when reloading a saved conversation. */
  initialMessages?: Message[]
  /** Called when the stream raises (network error, RUN_ERROR event, parse error). */
  onError?: (err: Error) => void
  /** Extra headers, e.g. `Authorization: Bearer ...` for authenticated endpoints. */
  headers?: Record<string, string>
  /** Called once per completed run (RUN_FINISHED). Useful for analytics or persistence. */
  onFinish?: (ctx: { messages: Message[]; threadId: string; runId: string }) => void
  /**
   * Human-in-the-Loop tools. Each entry maps a tool name to an implementation
   * the browser will resolve when the backend invokes it. Declarations are
   * forwarded as `tools: [...]` in every outgoing `RunAgentInput`, so the
   * backend LLM sees them alongside any server-side tools.
   *
   * See `FrontendTool` for the two flavors (auto-resolve vs interactive render).
   */
  frontendTools?: Record<string, FrontendTool<Record<string, unknown>, unknown>>
}

export interface UseAIChatReturn {
  /** All messages in the current thread (user + assistant + tool). */
  messages: Message[]
  /** True between RUN_STARTED and RUN_FINISHED (or until the caller `stop()`s). */
  isRunning: boolean
  /** Last stream error. Cleared automatically on next `send()`. */
  error: Error | null
  /** Send a new user message. Returns when the stream completes (or aborts). */
  send: (input: RunInput) => Promise<void>
  /** Cancel the in-flight stream. Messages already received are kept. */
  stop: () => void
  /** Clear all messages and errors. Keeps the same threadId. */
  reset: () => void
  /** Replace the full message list — useful when loading a saved conversation. */
  setMessages: (messages: Message[]) => void

  // ----- multi-agent / supervisor extensions -------------------------------
  /** Steps emitted by the agent (STEP_STARTED / STEP_FINISHED). Only relevant
   *  for multi-agent supervisors; empty for plain chatbots. */
  steps: AgentStep[]
  /** Shared state as maintained by STATE_SNAPSHOT / STATE_DELTA events. */
  state: Record<string, unknown>

  // ----- thread context ----------------------------------------------------
  threadId: string
  /** ID of the currently-running run, or null if idle. */
  runId: string | null

  // ----- human-in-the-loop -------------------------------------------------
  /**
   * Manually provide the result for a pending frontend tool call. Normally
   * you invoke `respond()` from the `FrontendTool.render` context; this
   * escape hatch is for scenarios where the UI lives outside the chat
   * container (e.g. a global modal) and you only have the tool_call_id.
   */
  respondToToolCall: (toolCallId: string, result: unknown) => void
}
