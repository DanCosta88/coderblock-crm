/**
 * ChatWidget — ready-made chat UI for single-agent scenarios (ai-chatbot, ai-rag).
 *
 * Pairs with `useAIChat`. Tailwind + shadcn-style primitives, zero external deps
 * beyond what the standard template ships with (`lucide-react`, `clsx`).
 *
 * You can use this widget as-is, or copy it into your feature folder and
 * customize the rendering (e.g. to show citations for RAG, or to render
 * tool-call results as rich cards instead of plain strings).
 */
import { useEffect, useRef, useState } from 'react'
import { Brain, ChevronDown, Loader2, SendHorizontal, StopCircle } from 'lucide-react'

import { cn } from '@/lib/utils'

import { useAIChat } from './useAIChat'
import type { FrontendTool, Message, ToolCall, UseAIChatOptions } from './types'

export interface ChatWidgetProps extends UseAIChatOptions {
  /** Visual title, displayed in the top bar. */
  title?: string
  /** Placeholder text for the textarea. */
  placeholder?: string
  /** Message shown to the user when the thread is empty. */
  emptyState?: React.ReactNode
  /** Optional className applied to the root container. */
  className?: string
  /** Render tool calls inline in the assistant message. Default: true. */
  showToolCalls?: boolean
  /** Show the collapsible reasoning block under assistant messages. Default: true. */
  showReasoning?: boolean
}

export function ChatWidget({
  title = 'AI Assistant',
  placeholder = 'Type a message…',
  emptyState,
  className,
  showToolCalls = true,
  showReasoning = true,
  ...chatOptions
}: ChatWidgetProps) {
  const { messages, isRunning, error, send, stop } = useAIChat(chatOptions)

  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Autoscroll to bottom when new content arrives
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || isRunning) return
    setInput('')
    await send({ message: trimmed })
  }

  const visibleMessages = messages.filter(
    (m) => m.role !== 'system' && (showToolCalls || m.role !== 'tool'),
  )

  return (
    <div
      className={cn(
        'flex flex-col bg-background border rounded-lg shadow-sm overflow-hidden',
        'h-[600px] max-h-full w-full',
        className,
      )}
    >
      <header className="px-4 py-3 border-b flex items-center gap-3 bg-muted/30">
        <div
          className={cn(
            'h-2 w-2 rounded-full transition-colors',
            isRunning
              ? 'bg-emerald-500 animate-pulse'
              : error
              ? 'bg-destructive'
              : 'bg-muted-foreground/40',
          )}
          aria-hidden
        />
        <h3 className="text-sm font-medium flex-1">{title}</h3>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      >
        {visibleMessages.length === 0 && !isRunning && (
          <div className="text-sm text-muted-foreground text-center py-8">
            {emptyState ?? (
              <>
                <p className="mb-1">No messages yet.</p>
                <p>Ask me anything to get started.</p>
              </>
            )}
          </div>
        )}

        {visibleMessages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            showToolCalls={showToolCalls}
            showReasoning={showReasoning}
            frontendTools={chatOptions.frontendTools}
          />
        ))}

        {isRunning && visibleMessages.every((m) => m.role !== 'assistant' || m.content === '') && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Thinking…</span>
          </div>
        )}

        {error && (
          <div className="rounded border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error.message}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t p-3 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit(e)
            }
          }}
          placeholder={placeholder}
          disabled={isRunning}
          rows={1}
          className={cn(
            'flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:opacity-50',
          )}
        />
        {isRunning ? (
          <button
            type="button"
            onClick={stop}
            className={cn(
              'inline-flex items-center justify-center rounded-md',
              'bg-destructive text-destructive-foreground hover:bg-destructive/90',
              'h-10 px-3 transition-colors',
            )}
            aria-label="Stop generation"
          >
            <StopCircle className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className={cn(
              'inline-flex items-center justify-center rounded-md',
              'bg-primary text-primary-foreground hover:bg-primary/90',
              'disabled:pointer-events-none disabled:opacity-50',
              'h-10 px-3 transition-colors',
            )}
            aria-label="Send message"
          >
            <SendHorizontal className="h-4 w-4" />
          </button>
        )}
      </form>
    </div>
  )
}

interface MessageBubbleProps {
  message: Message
  showToolCalls: boolean
  showReasoning: boolean
  frontendTools?: Record<string, FrontendTool<Record<string, unknown>, unknown>>
}

function MessageBubble({
  message,
  showToolCalls,
  showReasoning,
  frontendTools,
}: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const isTool = message.role === 'tool'
  const hasContent = message.content.length > 0
  const hasReasoning = showReasoning && !!message.reasoning

  if (isTool && !showToolCalls) return null

  return (
    <div
      className={cn(
        'flex flex-col gap-1',
        isUser ? 'items-end' : 'items-start',
      )}
    >
      {hasReasoning && (
        <ReasoningBlock reasoning={message.reasoning!} />
      )}

      {(hasContent || !hasReasoning) && (
        <div
          className={cn(
            'max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap',
            isUser
              ? 'bg-primary text-primary-foreground'
              : isTool
              ? 'bg-muted/50 border border-dashed text-xs font-mono'
              : 'bg-muted',
          )}
        >
          {isTool && (
            <div className="text-muted-foreground text-[10px] uppercase tracking-wider mb-1">
              Tool result
            </div>
          )}
          {message.content || (
            <span className="text-muted-foreground italic">(empty)</span>
          )}
        </div>
      )}

      {showToolCalls &&
        message.toolCalls?.map((tc) => (
          <ToolCallCard
            key={tc.id}
            toolCall={tc}
            frontendTools={frontendTools}
          />
        ))}
    </div>
  )
}

function ReasoningBlock({ reasoning }: { reasoning: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="max-w-[85%] w-full rounded-md border border-dashed bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-[11px] text-muted-foreground hover:bg-muted/50 transition-colors"
      >
        <Brain className="h-3 w-3" />
        <span className="flex-1 text-left font-medium uppercase tracking-wider">
          Thinking
        </span>
        <ChevronDown
          className={cn(
            'h-3 w-3 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && (
        <pre className="px-3 pb-2 pt-1 text-[11px] text-muted-foreground whitespace-pre-wrap overflow-x-auto max-h-64 overflow-y-auto">
          {reasoning}
        </pre>
      )}
    </div>
  )
}

interface ToolCallCardProps {
  toolCall: ToolCall
  frontendTools?: Record<string, FrontendTool<Record<string, unknown>, unknown>>
}

function ToolCallCard({ toolCall, frontendTools }: ToolCallCardProps) {
  // Interactive HITL path: if the user registered a `render` callback for this
  // tool name AND the hook attached a renderContext, mount the custom UI and
  // let the user's component call `respond(result)` to resume the run.
  const spec = frontendTools?.[toolCall.name]
  const ctx = toolCall.renderContext
  if (spec?.render && ctx) {
    return (
      <div className="max-w-[85%] w-full">
        {spec.render({
          ...ctx,
          status: toolCall.status,
          result: toolCall.result,
        })}
      </div>
    )
  }

  // Debug card fallback — used for backend-side tools OR frontend tools that
  // only declared a `handler` (auto-resolve, no UI).
  const isHitlPending =
    toolCall.isFrontend && toolCall.status === 'executing'

  return (
    <div
      className={cn(
        'max-w-[85%] mt-1 rounded-md border bg-card px-3 py-2 text-xs font-mono',
        isHitlPending && 'border-amber-500/50 bg-amber-500/5',
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="font-semibold">{toolCall.name}</span>
        {toolCall.isFrontend && (
          <span className="rounded bg-primary/10 text-primary px-1.5 py-0.5 text-[9px] uppercase tracking-wider">
            HITL
          </span>
        )}
        <span
          className={cn(
            'rounded px-1.5 py-0.5 text-[10px] uppercase',
            toolCall.status === 'complete'
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
              : toolCall.status === 'error'
              ? 'bg-destructive/15 text-destructive'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {toolCall.status}
        </span>
      </div>
      {toolCall.args && (
        <pre className="text-[11px] text-muted-foreground overflow-x-auto">
          {toolCall.args}
        </pre>
      )}
      {toolCall.result && (
        <div className="mt-1 pt-1 border-t text-[11px] text-foreground/80">
          → {toolCall.result}
        </div>
      )}
      {isHitlPending && (
        <div className="mt-1 text-[10px] text-amber-700 dark:text-amber-400">
          Waiting for user input…
        </div>
      )}
    </div>
  )
}
