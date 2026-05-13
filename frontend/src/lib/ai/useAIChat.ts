/**
 * useAIChat — React hook for AG-UI Protocol streaming agents.
 *
 * Consumes a Server-Sent Events stream from a FastAPI endpoint built with
 * `core.ag_ui_emitter.stream_response(...)` (backend helper) and exposes a
 * React-friendly view over the event stream.
 *
 * The hook is deliberately zero-dependency at runtime (no rxjs, no
 * `@ag-ui/client`, no Vercel AI SDK): uses native `fetch` + `ReadableStream`
 * and parses SSE (`data: {json}\n\n`) manually. TypeScript types are pulled
 * from `@ag-ui/core` (dev-time only) so we stay in sync with the protocol.
 *
 * Supported event types (others are ignored with a warning):
 *   - Lifecycle:   RUN_STARTED, RUN_FINISHED, RUN_ERROR
 *   - Steps:       STEP_STARTED, STEP_FINISHED
 *   - Text:        TEXT_MESSAGE_START, TEXT_MESSAGE_CONTENT, TEXT_MESSAGE_END
 *   - Tools:       TOOL_CALL_START, TOOL_CALL_ARGS, TOOL_CALL_END, TOOL_CALL_RESULT
 *   - State:       STATE_SNAPSHOT, STATE_DELTA
 *   - Reasoning:   REASONING_START, REASONING_MESSAGE_*, REASONING_END,
 *                  REASONING_MESSAGE_CHUNK, REASONING_ENCRYPTED_VALUE
 *
 * Human-in-the-Loop: register tools via `options.frontendTools`. When the
 * backend invokes one, the hook either auto-calls the registered `handler`
 * (sync or async) and resumes the run with the result, or exposes a
 * `renderContext.respond()` callback for interactive UI widgets.
 *
 * Usage:
 *
 *   const { messages, isRunning, send } = useAIChat({ endpoint: '/api/chat' })
 *   // then in JSX:
 *   <button onClick={() => send({ message: 'Hello!' })}>Send</button>
 */
import { useCallback, useEffect, useRef, useState } from 'react'

import type {
  AgentStep,
  FrontendTool,
  FrontendToolRenderContext,
  Message,
  ToolCall,
  ToolCallStatus,
  RunInput,
  UseAIChatOptions,
  UseAIChatReturn,
} from './types'

// ---------------------------------------------------------------------------
// AG-UI wire event shape — minimal structural typing (camelCase, matches the
// JSON shape emitted by `ag-ui-protocol`'s EventEncoder + our ag_ui_emitter.py)
// ---------------------------------------------------------------------------
type AGUIEvent =
  | { type: 'RUN_STARTED'; threadId: string; runId: string }
  | { type: 'RUN_FINISHED'; threadId: string; runId: string }
  | { type: 'RUN_ERROR'; message: string; code?: string }
  | { type: 'STEP_STARTED'; stepName: string }
  | { type: 'STEP_FINISHED'; stepName: string }
  | { type: 'TEXT_MESSAGE_START'; messageId: string; role: string }
  | { type: 'TEXT_MESSAGE_CONTENT'; messageId: string; delta: string }
  | { type: 'TEXT_MESSAGE_END'; messageId: string }
  | {
      type: 'TOOL_CALL_START'
      toolCallId: string
      toolCallName: string
      parentMessageId?: string
    }
  | { type: 'TOOL_CALL_ARGS'; toolCallId: string; delta: string }
  | { type: 'TOOL_CALL_END'; toolCallId: string }
  | {
      type: 'TOOL_CALL_RESULT'
      toolCallId: string
      content: string
      messageId: string
      role: string
    }
  | { type: 'STATE_SNAPSHOT'; snapshot: Record<string, unknown> }
  | {
      type: 'STATE_DELTA'
      delta: Array<{ op: string; path: string; value?: unknown }>
    }
  | { type: 'REASONING_START'; messageId: string }
  | { type: 'REASONING_END'; messageId: string }
  | { type: 'REASONING_MESSAGE_START'; messageId: string; role: 'reasoning' }
  | { type: 'REASONING_MESSAGE_CONTENT'; messageId: string; delta: string }
  | { type: 'REASONING_MESSAGE_END'; messageId: string }
  | { type: 'REASONING_MESSAGE_CHUNK'; messageId: string; delta?: string }
  | { type: 'REASONING_ENCRYPTED_VALUE'; messageId: string; value: string }
  | { type: string; [key: string]: unknown } // future-proofing catch-all

const SSE_CHUNK_SPLIT = /\r?\n\r?\n/

function tryParseJSON(text: string): Record<string, unknown> | undefined {
  try {
    const obj = JSON.parse(text)
    return typeof obj === 'object' && obj !== null
      ? (obj as Record<string, unknown>)
      : undefined
  } catch {
    return undefined
  }
}

// Simple JSON Patch applier (RFC 6902 subset: add, replace, remove).
// Intentionally minimal — if you need `test`, `move`, `copy`, swap for `fast-json-patch`.
function applyJsonPatch(
  state: Record<string, unknown>,
  patch: Array<{ op: string; path: string; value?: unknown }>,
): Record<string, unknown> {
  const next: Record<string, unknown> = JSON.parse(JSON.stringify(state))
  for (const { op, path, value } of patch) {
    const parts = path.split('/').filter(Boolean).map(decodePatchSegment)
    if (parts.length === 0) continue
    const last = parts.pop()!
    let cursor: Record<string, unknown> = next
    for (const part of parts) {
      if (typeof cursor[part] !== 'object' || cursor[part] === null) {
        cursor[part] = {}
      }
      cursor = cursor[part] as Record<string, unknown>
    }
    if (op === 'remove') {
      delete cursor[last]
    } else if (op === 'add' || op === 'replace') {
      cursor[last] = value
    }
  }
  return next
}

function decodePatchSegment(s: string): string {
  return s.replace(/~1/g, '/').replace(/~0/g, '~')
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

export function useAIChat(options: UseAIChatOptions): UseAIChatReturn {
  const {
    endpoint,
    threadId: threadIdOption,
    initialMessages,
    onError,
    onFinish,
    headers,
    frontendTools,
  } = options

  const [messages, setMessagesState] = useState<Message[]>(
    () => initialMessages ?? [],
  )
  const [steps, setSteps] = useState<AgentStep[]>([])
  const [state, setState] = useState<Record<string, unknown>>({})
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [runId, setRunId] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const threadIdRef = useRef<string>(threadIdOption ?? randomId())
  const messagesRef = useRef<Message[]>(initialMessages ?? [])

  // Reasoning buffer: accumulates REASONING_MESSAGE_CONTENT deltas and is
  // flushed either onto the next TEXT_MESSAGE_START's Message.reasoning, or
  // as a standalone reasoning-only assistant message at RUN_FINISHED if no
  // visible text follows. Cleared at every RUN_STARTED.
  const reasoningBufferRef = useRef<string>('')

  // Pending frontend tool calls awaiting a result (HITL). Populated at
  // TOOL_CALL_END when the tool name is registered in `frontendTools`.
  // Cleared entry-by-entry as results come in via respondToToolCall.
  const pendingToolCallsRef = useRef<
    Map<string, { toolName: string; args: Record<string, unknown> }>
  >(new Map())

  // Mutable mirror of `frontendTools` so event handlers (memoized with empty
  // deps) always see the latest registry without re-creating the closure.
  const frontendToolsRef = useRef(frontendTools)
  useEffect(() => {
    frontendToolsRef.current = frontendTools
  }, [frontendTools])

  // Forward refs for functions defined later in the component body. These are
  // populated by useEffect after the callbacks are created so early events
  // that need to trigger them (e.g. RUN_FINISHED auto-resolving HITL tools)
  // always see the latest versions.
  const sendRef = useRef<((input: RunInput) => Promise<void>) | null>(null)
  const respondToToolCallRef = useRef<(id: string, result: unknown) => void>(
    () => {},
  )

  // Keep refs in sync with state so event handlers always see the latest snapshot
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  // If caller changes threadId, regenerate the ref (but keep stable per mount
  // when threadId is omitted, so send()s stay in the same thread).
  useEffect(() => {
    if (threadIdOption && threadIdOption !== threadIdRef.current) {
      threadIdRef.current = threadIdOption
    }
  }, [threadIdOption])

  const setMessages = useCallback((next: Message[]) => {
    messagesRef.current = next
    setMessagesState(next)
  }, [])

  /**
   * Apply a frontend tool result to messages state — updates the tool call's
   * status/result and appends a role='tool' Message. Does NOT trigger a
   * follow-up send; callers decide when to resume.
   */
  const finalizeToolCall = useCallback(
    (toolCallId: string, result: unknown): Message[] => {
      pendingToolCallsRef.current.delete(toolCallId)
      const serialized =
        typeof result === 'string' ? result : JSON.stringify(result)

      const withUpdatedCall = messagesRef.current.map((m) => {
        if (!m.toolCalls?.some((tc) => tc.id === toolCallId)) return m
        return {
          ...m,
          toolCalls: m.toolCalls.map((tc) =>
            tc.id === toolCallId
              ? {
                  ...tc,
                  status: 'complete' as ToolCallStatus,
                  result: serialized,
                  renderContext: tc.renderContext
                    ? {
                        ...tc.renderContext,
                        status: 'complete' as ToolCallStatus,
                        result,
                      }
                    : undefined,
                }
              : tc,
          ),
        }
      })

      const toolMessage: Message = {
        id: randomId(),
        role: 'tool',
        content: serialized,
        toolCallId,
        createdAt: Date.now(),
      }

      const next = [...withUpdatedCall, toolMessage]
      messagesRef.current = next
      setMessagesState(next)
      return next
    },
    [],
  )

  const respondToToolCall = useCallback(
    (toolCallId: string, result: unknown) => {
      if (!pendingToolCallsRef.current.has(toolCallId)) return
      const nextMessages = finalizeToolCall(toolCallId, result)
      if (pendingToolCallsRef.current.size === 0) {
        // All frontend tools in this run resolved → resume conversation.
        void sendRef.current?.({ messages: nextMessages })
      }
    },
    [finalizeToolCall],
  )

  useEffect(() => {
    respondToToolCallRef.current = respondToToolCall
  }, [respondToToolCall])

  /**
   * After a run finishes, fire `handler` callbacks for every pending frontend
   * tool call that does NOT have a `render` (auto-resolve path). Interactive
   * tools (with `render`) stay pending until the UI calls `respond()`.
   * If all pending tools are auto-resolved, a follow-up run is triggered.
   */
  const autoResolveFrontendTools = useCallback(async () => {
    const registry = frontendToolsRef.current
    if (!registry) return
    const entries = Array.from(pendingToolCallsRef.current.entries())
    const autoEntries = entries.filter(([, info]) => {
      const spec = registry[info.toolName] as
        | FrontendTool<Record<string, unknown>, unknown>
        | undefined
      return spec?.handler && !spec?.render
    })
    if (autoEntries.length === 0) return

    await Promise.all(
      autoEntries.map(async ([id, info]) => {
        const spec = registry[info.toolName]!
        try {
          const result = await spec.handler!(info.args)
          finalizeToolCall(id, result)
        } catch (err) {
          finalizeToolCall(id, { error: String(err) })
        }
      }),
    )

    // If no interactive tools remain, resume the run with the accumulated
    // results. If interactive tools are still pending, the UI is responsible
    // for calling respondToToolCall later, which will trigger the resume.
    if (pendingToolCallsRef.current.size === 0) {
      void sendRef.current?.({ messages: messagesRef.current })
    }
  }, [finalizeToolCall])

  const autoResolveRef = useRef(autoResolveFrontendTools)
  useEffect(() => {
    autoResolveRef.current = autoResolveFrontendTools
  }, [autoResolveFrontendTools])

  const handleEvent = useCallback((event: AGUIEvent) => {
    switch (event.type) {
      case 'RUN_STARTED':
        setRunId((event as { runId: string }).runId)
        reasoningBufferRef.current = ''
        return

      case 'RUN_FINISHED': {
        setRunId(null)
        // Flush orphan reasoning (arrived without a following TEXT_MESSAGE_START)
        // as a standalone reasoning-only assistant message.
        if (reasoningBufferRef.current) {
          const reasoning = reasoningBufferRef.current
          reasoningBufferRef.current = ''
          const msg: Message = {
            id: randomId(),
            role: 'assistant',
            content: '',
            reasoning,
            createdAt: Date.now(),
          }
          setMessagesState((prev) => {
            const next = [...prev, msg]
            messagesRef.current = next
            return next
          })
        }
        // Kick off HITL auto-resolve asynchronously — detaches from the SSE
        // reader loop so handlers can themselves be async.
        if (pendingToolCallsRef.current.size > 0) {
          queueMicrotask(() => {
            void autoResolveRef.current()
          })
        }
        return
      }

      case 'RUN_ERROR': {
        const msg = (event as { message: string }).message ?? 'Agent error'
        setError(new Error(msg))
        setRunId(null)
        reasoningBufferRef.current = ''
        pendingToolCallsRef.current.clear()
        return
      }

      case 'STEP_STARTED': {
        const name = (event as { stepName: string }).stepName
        setSteps((prev) => [
          ...prev,
          { name, startedAt: Date.now(), status: 'running' },
        ])
        return
      }

      case 'STEP_FINISHED': {
        const name = (event as { stepName: string }).stepName
        setSteps((prev) =>
          prev.map((s) =>
            s.name === name && s.status === 'running'
              ? { ...s, finishedAt: Date.now(), status: 'done' }
              : s,
          ),
        )
        return
      }

      case 'TEXT_MESSAGE_START': {
        const e = event as { messageId: string; role: string }
        // Flush any buffered reasoning onto this message
        const reasoning = reasoningBufferRef.current || undefined
        reasoningBufferRef.current = ''
        const msg: Message = {
          id: e.messageId,
          role: (e.role as Message['role']) ?? 'assistant',
          content: '',
          reasoning,
          createdAt: Date.now(),
        }
        setMessagesState((prev) => {
          const next = [...prev, msg]
          messagesRef.current = next
          return next
        })
        return
      }

      // ------------ Reasoning (extended thinking, o1/o3, R1, Claude) ------
      case 'REASONING_START':
      case 'REASONING_MESSAGE_START':
      case 'REASONING_MESSAGE_END':
      case 'REASONING_END':
        // Structural markers — no-op for our buffer model. Kept here so they
        // don't fall through to the "unknown event" branch in development.
        return

      case 'REASONING_MESSAGE_CONTENT': {
        const e = event as { delta?: string }
        if (typeof e.delta === 'string') {
          reasoningBufferRef.current += e.delta
        }
        return
      }

      case 'REASONING_MESSAGE_CHUNK': {
        // Alternative compressed form — same treatment as CONTENT.
        const e = event as { delta?: string }
        if (typeof e.delta === 'string') {
          reasoningBufferRef.current += e.delta
        }
        return
      }

      case 'REASONING_ENCRYPTED_VALUE':
        // Opaque encrypted reasoning trace (OpenAI o3 variant). Ignored — the
        // platform doesn't surface encrypted traces; include them in messages
        // only if you want to forward them back to the provider on resume.
        return

      case 'TEXT_MESSAGE_CONTENT': {
        const e = event as { messageId: string; delta: string }
        setMessagesState((prev) => {
          const idx = prev.findIndex((m) => m.id === e.messageId)
          if (idx === -1) return prev
          const next = prev.slice()
          next[idx] = { ...next[idx], content: next[idx].content + e.delta }
          messagesRef.current = next
          return next
        })
        return
      }

      case 'TEXT_MESSAGE_END':
        // Nothing to do — the message is finalized when content stops arriving.
        // The event is useful for downstream consumers (e.g. analytics).
        return

      case 'TOOL_CALL_START': {
        const e = event as {
          toolCallId: string
          toolCallName: string
          parentMessageId?: string
        }
        const toolCall: ToolCall = {
          id: e.toolCallId,
          name: e.toolCallName,
          args: '',
          status: 'streaming_args',
          parentMessageId: e.parentMessageId,
        }
        setMessagesState((prev) => {
          if (!e.parentMessageId) {
            // Orphan tool call — attach to a synthetic assistant message
            const msg: Message = {
              id: randomId(),
              role: 'assistant',
              content: '',
              toolCalls: [toolCall],
              createdAt: Date.now(),
            }
            const next = [...prev, msg]
            messagesRef.current = next
            return next
          }
          const idx = prev.findIndex((m) => m.id === e.parentMessageId)
          if (idx === -1) return prev
          const next = prev.slice()
          const current = next[idx]
          next[idx] = {
            ...current,
            toolCalls: [...(current.toolCalls ?? []), toolCall],
          }
          messagesRef.current = next
          return next
        })
        return
      }

      case 'TOOL_CALL_ARGS': {
        const e = event as { toolCallId: string; delta: string }
        setMessagesState((prev) => {
          const next = prev.map((m) => {
            if (!m.toolCalls?.some((tc) => tc.id === e.toolCallId)) return m
            return {
              ...m,
              toolCalls: m.toolCalls.map((tc) =>
                tc.id === e.toolCallId
                  ? { ...tc, args: tc.args + e.delta }
                  : tc,
              ),
            }
          })
          messagesRef.current = next
          return next
        })
        return
      }

      case 'TOOL_CALL_END': {
        const e = event as { toolCallId: string }
        const registry = frontendToolsRef.current
        setMessagesState((prev) => {
          const next = prev.map((m) => {
            if (!m.toolCalls?.some((tc) => tc.id === e.toolCallId)) return m
            return {
              ...m,
              toolCalls: m.toolCalls.map((tc) => {
                if (tc.id !== e.toolCallId) return tc
                const parsedArgs =
                  tryParseJSON(tc.args) ?? ({} as Record<string, unknown>)
                const spec = registry?.[tc.name] as
                  | FrontendTool<Record<string, unknown>, unknown>
                  | undefined

                if (!spec) {
                  // Backend-side tool — just mark as executing; a
                  // TOOL_CALL_RESULT event will flip it to 'complete'.
                  return {
                    ...tc,
                    status: 'executing' as ToolCallStatus,
                    parsedArgs,
                  }
                }

                // Frontend-side tool (HITL). Register for resolution.
                pendingToolCallsRef.current.set(tc.id, {
                  toolName: tc.name,
                  args: parsedArgs,
                })

                const updated: ToolCall = {
                  ...tc,
                  status: 'executing' as ToolCallStatus,
                  parsedArgs,
                  isFrontend: true,
                }

                if (spec.render) {
                  // Build a stable render context. `respond` reads the ref so
                  // the latest closure is always invoked even if the caller
                  // re-mounts the rendered node later.
                  const ctx: FrontendToolRenderContext<
                    Record<string, unknown>,
                    unknown
                  > = {
                    args: parsedArgs,
                    status: 'executing',
                    respond: (result) =>
                      respondToToolCallRef.current(e.toolCallId, result),
                    toolCall: updated,
                  }
                  updated.renderContext = ctx
                }

                return updated
              }),
            }
          })
          messagesRef.current = next
          return next
        })
        return
      }

      case 'TOOL_CALL_RESULT': {
        const e = event as {
          toolCallId: string
          content: string
          messageId: string
          role: string
        }
        setMessagesState((prev) => {
          const withUpdatedCall = prev.map((m) => {
            if (!m.toolCalls?.some((tc) => tc.id === e.toolCallId)) return m
            return {
              ...m,
              toolCalls: m.toolCalls.map((tc) =>
                tc.id === e.toolCallId
                  ? { ...tc, result: e.content, status: 'complete' as ToolCallStatus }
                  : tc,
              ),
            }
          })
          const toolMessage: Message = {
            id: e.messageId,
            role: 'tool',
            content: e.content,
            toolCallId: e.toolCallId,
            createdAt: Date.now(),
          }
          const next = [...withUpdatedCall, toolMessage]
          messagesRef.current = next
          return next
        })
        return
      }

      case 'STATE_SNAPSHOT': {
        const e = event as { snapshot: Record<string, unknown> }
        setState(e.snapshot ?? {})
        return
      }

      case 'STATE_DELTA': {
        const e = event as {
          delta: Array<{ op: string; path: string; value?: unknown }>
        }
        setState((prev) => applyJsonPatch(prev, e.delta ?? []))
        return
      }

      default:
        // Silently ignore unknown events (forward-compat with new AG-UI types)
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.debug('[useAIChat] ignored event', event.type, event)
        }
        return
    }
  }, [])

  const send = useCallback(
    async (input: RunInput): Promise<void> => {
      // Cancel any in-flight stream
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      const userMsg: Message | null =
        input.message !== undefined && input.message !== null
          ? {
              id: randomId(),
              role: 'user',
              content: input.message,
              createdAt: Date.now(),
            }
          : null

      const basis = input.messages ?? messagesRef.current
      const nextMessages = userMsg ? [...basis, userMsg] : basis
      setMessages(nextMessages)
      setIsRunning(true)
      setError(null)
      setSteps([])

      const newRunId = randomId()
      setRunId(newRunId)

      // Merge frontend-declared tools with any request-scoped tools. Frontend
      // tools come first so they're visible to the LLM as callable; backend
      // tools (passed via input.tools) follow.
      const frontendToolSpecs = Object.entries(
        frontendToolsRef.current ?? {},
      ).map(([name, t]) => ({
        name,
        description: t.description,
        parameters: t.parameters,
      }))
      const mergedTools = [...frontendToolSpecs, ...(input.tools ?? [])]

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            ...(headers ?? {}),
          },
          body: JSON.stringify({
            threadId: threadIdRef.current,
            runId: newRunId,
            messages: nextMessages.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              // Forward tool results so the backend can see HITL responses
              // on resume. For role='tool' messages this is the tool_call_id.
              ...(m.toolCallId ? { toolCallId: m.toolCallId } : {}),
            })),
            tools: mergedTools,
            context: input.context ?? [],
            state,
            forwardedProps: {},
          }),
        })

        if (!response.ok) {
          const text = await response.text().catch(() => '')
          throw new Error(`HTTP ${response.status} ${response.statusText}: ${text}`)
        }
        if (!response.body) {
          throw new Error('Response has no body')
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          // Split on SSE delimiter (blank line). Incomplete trailing chunk stays in buffer.
          const chunks = buffer.split(SSE_CHUNK_SPLIT)
          buffer = chunks.pop() ?? ''

          for (const chunk of chunks) {
            // Each chunk may have multiple lines; we only care about `data:` ones
            const dataLines = chunk
              .split(/\r?\n/)
              .filter((line) => line.startsWith('data:'))
              .map((line) => line.replace(/^data:\s?/, ''))
            if (dataLines.length === 0) continue
            const raw = dataLines.join('\n')
            if (raw === '[DONE]') continue // legacy sentinel — ignore
            try {
              const event = JSON.parse(raw) as AGUIEvent
              handleEvent(event)
            } catch (err) {
              if (import.meta.env.DEV) {
                // eslint-disable-next-line no-console
                console.warn('[useAIChat] malformed SSE payload', raw, err)
              }
            }
          }
        }

        onFinish?.({
          messages: messagesRef.current,
          threadId: threadIdRef.current,
          runId: newRunId,
        })
      } catch (err) {
        const e = err as Error
        if (e.name === 'AbortError') return // user cancelled, not an error
        setError(e)
        onError?.(e)
      } finally {
        setIsRunning(false)
        setRunId(null)
        abortRef.current = null
      }
    },
    [endpoint, handleEvent, headers, onError, onFinish, setMessages, state],
  )

  // Keep sendRef in sync so HITL auto-resume and respondToToolCall can call
  // `send` without being part of their dependency arrays.
  useEffect(() => {
    sendRef.current = send
  }, [send])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setIsRunning(false)
    setRunId(null)
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setMessages([])
    setSteps([])
    setState({})
    setError(null)
    setIsRunning(false)
    setRunId(null)
    reasoningBufferRef.current = ''
    pendingToolCallsRef.current.clear()
  }, [setMessages])

  // Cleanup on unmount: cancel any in-flight stream
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      abortRef.current = null
    }
  }, [])

  return {
    messages,
    isRunning,
    error,
    send,
    stop,
    reset,
    setMessages,
    steps,
    state,
    threadId: threadIdRef.current,
    runId,
    respondToToolCall,
  }
}
