/**
 * Barrel export for `src/lib/ai/` — the Coderblock AG-UI client layer.
 *
 * Import anywhere in the project via `@/lib/ai`, e.g.:
 *   import { useAIChat, ChatWidget } from '@/lib/ai'
 *
 * See also: `backend/core/ag_ui_emitter.py` — the Python side of the protocol.
 */
export { useAIChat } from './useAIChat'
export { ChatWidget } from './ChatWidget'
export { MultiAgentView } from './MultiAgentView'
export type {
  AgentStep,
  FrontendTool,
  FrontendToolRenderContext,
  Message,
  MessageRole,
  RunInput,
  ToolCall,
  ToolCallStatus,
  UseAIChatOptions,
  UseAIChatReturn,
} from './types'
export type { ChatWidgetProps } from './ChatWidget'
export type { MultiAgentViewProps } from './MultiAgentView'
