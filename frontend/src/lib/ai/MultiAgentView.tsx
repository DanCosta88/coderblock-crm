/**
 * MultiAgentView — ready-made UI for supervisor/sub-agent scenarios (ai-multi-agent).
 *
 * Renders:
 *   - The conversation (same as ChatWidget, but with tool-calls rendered as cards).
 *   - A right-hand sidebar showing the STEP timeline (sub-agents as they start/finish).
 *   - A collapsible debug drawer showing the current shared state (from STATE_SNAPSHOT/DELTA).
 *
 * Pairs with `useAIChat` — the same hook handles both chatbot and multi-agent
 * scenarios; MultiAgentView just exposes the `steps` and `state` fields the hook
 * already tracks from AG-UI `STEP_*` and `STATE_*` events.
 */
import { useEffect, useRef, useState } from 'react'
import { Brain, ChevronDown, Loader2, SendHorizontal, StopCircle } from 'lucide-react'

import { cn } from '@/lib/utils'

import { useAIChat } from './useAIChat'
import type {
  AgentStep,
  FrontendTool,
  Message,
  ToolCall,
  UseAIChatOptions,
} from './types'

export interface MultiAgentViewProps extends UseAIChatOptions {
  title?: string
  placeholder?: string
  emptyState?: React.ReactNode
  className?: string
  /** Show the JSON shared-state drawer at the bottom. Default: true. */
  showStateDrawer?: boolean
  /** Show the step timeline sidebar. Default: true. */
  showStepTimeline?: boolean
  /** Render the collapsible reasoning block per message. Default: true. */
  showReasoning?: boolean
}

export function MultiAgentView({
  title = 'Multi-Agent System',
  placeholder = 'Describe your task…',
  emptyState,
  className,
  showStateDrawer = true,
  showStepTimeline = true,
  showReasoning = true,
  ...chatOptions
}: MultiAgentViewProps) {
  const chat = useAIChat(chatOptions)
  const { messages, steps, state, isRunning, error, send, stop } = chat

  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, steps])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || isRunning) return
    setInput('')
    await send({ message: trimmed })
  }

  return (
    <div
      className={cn(
        'flex flex-col bg-background border rounded-lg shadow-sm overflow-hidden',
        'h-[700px] max-h-full w-full',
        className,
      )}
    >
      <header className="px-4 py-3 border-b flex items-center gap-3 bg-muted/30">
        <div
          className={cn(
            'h-2 w-2 rounded-full',
            isRunning
              ? 'bg-emerald-500 animate-pulse'
              : error
              ? 'bg-destructive'
              : 'bg-muted-foreground/40',
          )}
          aria-hidden
        />
        <h3 className="text-sm font-medium flex-1">{title}</h3>
        {isRunning && (
          <span className="text-xs text-muted-foreground">
            {steps.filter((s) => s.status === 'running').length} step(s) running
          </span>
        )}
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && !isRunning && (
            <div className="text-sm text-muted-foreground text-center py-8">
              {emptyState ?? (
                <>
                  <p className="mb-1">No conversation yet.</p>
                  <p>Send a task to the supervisor to start.</p>
                </>
              )}
            </div>
          )}

          {messages.map((m) => (
            <MessageRow
              key={m.id}
              message={m}
              showReasoning={showReasoning}
              frontendTools={chatOptions.frontendTools}
            />
          ))}

          {error && (
            <div className="rounded border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error.message}
            </div>
          )}
        </div>

        {showStepTimeline && (steps.length > 0 || isRunning) && (
          <aside className="w-64 border-l bg-muted/20 px-3 py-4 overflow-y-auto">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Agent Activity
            </h4>
            <ol className="space-y-2">
              {steps.map((step, idx) => (
                <StepRow key={`${step.name}-${idx}`} step={step} />
              ))}
              {isRunning && steps.length === 0 && (
                <li className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Supervisor warming up…
                </li>
              )}
            </ol>
          </aside>
        )}
      </div>

      {showStateDrawer && (
        <StateDrawer state={state} />
      )}

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
          rows={2}
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
              'h-auto px-3 transition-colors',
            )}
            aria-label="Stop"
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
              'h-auto px-3 transition-colors',
            )}
            aria-label="Send"
          >
            <SendHorizontal className="h-4 w-4" />
          </button>
        )}
      </form>
    </div>
  )
}

interface MessageRowProps {
  message: Message
  showReasoning: boolean
  frontendTools?: Record<string, FrontendTool<Record<string, unknown>, unknown>>
}

function MessageRow({ message, showReasoning, frontendTools }: MessageRowProps) {
  const isUser = message.role === 'user'
  const isTool = message.role === 'tool'
  const hasReasoning = showReasoning && !!message.reasoning

  return (
    <div className={cn('flex flex-col', isUser ? 'items-end' : 'items-start')}>
      {hasReasoning && (
        <ReasoningBlock reasoning={message.reasoning!} />
      )}

      <div
        className={cn(
          'max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap',
          isUser
            ? 'bg-primary text-primary-foreground'
            : isTool
            ? 'bg-card border border-dashed font-mono text-xs'
            : 'bg-muted',
        )}
      >
        {isTool && (
          <div className="text-muted-foreground text-[10px] uppercase tracking-wider mb-1">
            Sub-agent / tool result
          </div>
        )}
        {message.content || <span className="italic opacity-50">(empty)</span>}
      </div>

      {message.toolCalls?.map((tc) => (
        <ToolCallInline
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
    <div className="max-w-[85%] w-full mb-1 rounded-md border border-dashed bg-muted/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-[11px] text-muted-foreground hover:bg-muted/40 transition-colors"
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

interface ToolCallInlineProps {
  toolCall: ToolCall
  frontendTools?: Record<string, FrontendTool<Record<string, unknown>, unknown>>
}

function ToolCallInline({ toolCall, frontendTools }: ToolCallInlineProps) {
  const spec = frontendTools?.[toolCall.name]
  const ctx = toolCall.renderContext
  if (spec?.render && ctx) {
    return (
      <div className="max-w-[85%] w-full mt-1">
        {spec.render({
          ...ctx,
          status: toolCall.status,
          result: toolCall.result,
        })}
      </div>
    )
  }

  const isHitlPending =
    toolCall.isFrontend && toolCall.status === 'executing'

  return (
    <div
      className={cn(
        'max-w-[85%] mt-1 rounded border bg-background/50 px-2 py-1 text-[11px] font-mono',
        isHitlPending && 'border-amber-500/50 bg-amber-500/5',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="font-semibold">{toolCall.name}</span>
        {toolCall.isFrontend && (
          <span className="rounded bg-primary/10 text-primary px-1 text-[9px] uppercase tracking-wider">
            HITL
          </span>
        )}
        <span
          className={cn(
            'rounded px-1 text-[10px]',
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
        <pre className="mt-1 text-muted-foreground overflow-x-auto">
          {toolCall.args}
        </pre>
      )}
      {toolCall.result && (
        <div className="mt-1 pt-1 border-t text-foreground/80">
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

function StepRow({ step }: { step: AgentStep }) {
  const running = step.status === 'running'
  const elapsed = step.finishedAt
    ? ((step.finishedAt - step.startedAt) / 1000).toFixed(1)
    : null

  return (
    <li className="flex items-start gap-2 text-xs">
      <div
        className={cn(
          'mt-1 h-2 w-2 rounded-full shrink-0',
          running
            ? 'bg-emerald-500 animate-pulse'
            : 'bg-muted-foreground/40',
        )}
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{step.name}</div>
        <div className="text-muted-foreground text-[10px]">
          {running ? 'running…' : elapsed ? `done · ${elapsed}s` : 'done'}
        </div>
      </div>
    </li>
  )
}

function StateDrawer({ state }: { state: Record<string, unknown> }) {
  const [open, setOpen] = useState(false)
  const hasState = Object.keys(state).length > 0

  if (!hasState && !open) return null

  return (
    <div className="border-t bg-muted/10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:bg-muted/20 transition-colors"
      >
        <ChevronDown
          className={cn(
            'h-3 w-3 transition-transform',
            open && 'rotate-180',
          )}
        />
        <span>Shared state ({Object.keys(state).length} keys)</span>
      </button>
      {open && (
        <pre className="max-h-40 overflow-auto px-4 pb-3 text-[11px] font-mono text-muted-foreground">
          {JSON.stringify(state, null, 2)}
        </pre>
      )}
    </div>
  )
}
