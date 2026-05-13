"""
AG-UI event emitter — thin FastAPI helper on top of `ag-ui-protocol`.

The AG-UI Protocol is an open MIT standard (https://docs.ag-ui.com) for streaming
agent events to frontends via Server-Sent Events. This module gives FastAPI routes
an ergonomic API to emit the 16 core event types without the boilerplate of
hand-building each Pydantic event + calling EventEncoder.encode() every time.

## Typical usage (chatbot)

```python
from fastapi import APIRouter, Depends
from ag_ui.core import RunAgentInput
from core.ag_ui_emitter import stream_response, AGUIEmitter, parse_run_input
from features.ai_chatbot.service import call_openai_stream

router = APIRouter(prefix="/chat", tags=["chat"])

@router.post("")
async def chat(input_data: RunAgentInput = Depends(parse_run_input)):
    async def run(emit: AGUIEmitter):
        sse, msg_id = emit.text_message_start()
        yield sse
        async for chunk in call_openai_stream(input_data.messages):
            yield emit.text_message_content(msg_id, chunk)
        yield emit.text_message_end(msg_id)

    return stream_response(input_data, run)
```

`stream_response` handles `RUN_STARTED` / `RUN_FINISHED` / `RUN_ERROR` automatically.

**Always wrap the body in `Depends(parse_run_input)`** (never take a raw
`RunAgentInput` directly) — that helper tolerates a few common client-side
quirks (missing message `id`, `state: null`, missing `tools`/`context`) that
bare Pydantic validation rejects with HTTP 422.

## Typical usage (multi-agent supervisor with sub-agents)

```python
@router.post("")
async def supervisor(input_data: RunAgentInput):
    async def run(emit: AGUIEmitter):
        # top-level supervisor reasoning
        sse, sup_msg = emit.text_message_start()
        yield sse
        yield emit.text_message_content(sup_msg, "Delegating to research agent...")
        yield emit.text_message_end(sup_msg)

        # sub-agent 1
        yield emit.step_started("research_agent")
        sse, research_msg = emit.text_message_start()
        yield sse
        async for chunk in call_research_agent(input_data.messages):
            yield emit.text_message_content(research_msg, chunk)
        yield emit.text_message_end(research_msg)
        yield emit.step_finished("research_agent")

        # sub-agent 2 ... etc.

    return stream_response(input_data, run)
```

## Human-in-the-Loop (frontend-side tools)

The AG-UI pattern for HITL is: the frontend declares tools in
`RunAgentInput.tools`, the backend forwards them to the LLM as callable tool
schemas, and when the LLM decides to invoke a frontend tool the backend emits
`TOOL_CALL_START / ARGS / END` but NOT `TOOL_CALL_RESULT`. The run ends there;
the frontend (our `useAIChat` hook) executes the tool locally (via a React
callback or UI widget the user interacts with) and fires a new POST that
appends a `role: 'tool'` message carrying the result. The backend, on the
next request, sees the tool message in `input_data.messages` and continues
the conversation.

Use `is_frontend_tool(name, input_data)` inside your service code to decide
whether to execute a tool backend-side or emit the events and return control
to the client. See the `ai-chatbot` and `ai-multi-agent` SKILL sections for
a full example.

## Design notes

- All methods return SSE-formatted strings that you `yield` from an async generator.
- `AGUIEmitter` is stateful (tracks message/tool-call IDs) and not thread-safe —
  instantiate one per request.
- The `accept` header is honored if you pass it through; default is
  `text/event-stream`. Set `Accept: application/vnd.ag-ui.events+proto` if you
  later adopt protobuf encoding (not currently used by our frontend hook).
"""
from __future__ import annotations

import uuid
from typing import Any, AsyncIterator, Awaitable, Callable, Optional

from ag_ui.core import (
    EventType,
    ReasoningEndEvent,
    ReasoningMessageContentEvent,
    ReasoningMessageEndEvent,
    ReasoningMessageStartEvent,
    ReasoningStartEvent,
    RunAgentInput,
    RunErrorEvent,
    RunFinishedEvent,
    RunStartedEvent,
    StateDeltaEvent,
    StateSnapshotEvent,
    StepFinishedEvent,
    StepStartedEvent,
    TextMessageContentEvent,
    TextMessageEndEvent,
    TextMessageStartEvent,
    ToolCallArgsEvent,
    ToolCallEndEvent,
    ToolCallResultEvent,
    ToolCallStartEvent,
)
from ag_ui.encoder import EventEncoder
from fastapi import HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import ValidationError


class AGUIEmitter:
    """
    Encodes AG-UI events as Server-Sent Events for FastAPI streaming responses.

    All methods return an SSE-formatted string (e.g. `data: {...}\\n\\n`) that
    should be yielded by an async generator passed to a StreamingResponse.

    Each emitter instance auto-generates monotonic message_id and tool_call_id
    values scoped to the current run_id, so callers don't have to manage them
    manually (but you can pass your own via the optional params).
    """

    def __init__(self, input_data: RunAgentInput, *, accept: Optional[str] = None):
        self.input_data = input_data
        self.encoder = EventEncoder(accept=accept or "text/event-stream")
        self._message_counter = 0
        self._tool_call_counter = 0

    def _next_message_id(self) -> str:
        self._message_counter += 1
        return f"msg_{self.input_data.run_id}_{self._message_counter}"

    def _next_tool_call_id(self) -> str:
        self._tool_call_counter += 1
        return f"tool_{self.input_data.run_id}_{self._tool_call_counter}"

    # ----------------------------------------------------------------- lifecycle

    def run_started(self) -> str:
        return self.encoder.encode(
            RunStartedEvent(
                type=EventType.RUN_STARTED,
                thread_id=self.input_data.thread_id,
                run_id=self.input_data.run_id,
            )
        )

    def run_finished(self) -> str:
        return self.encoder.encode(
            RunFinishedEvent(
                type=EventType.RUN_FINISHED,
                thread_id=self.input_data.thread_id,
                run_id=self.input_data.run_id,
            )
        )

    def run_error(self, message: str, *, code: Optional[str] = None) -> str:
        return self.encoder.encode(
            RunErrorEvent(
                type=EventType.RUN_ERROR,
                message=message,
                code=code,
            )
        )

    # ----------------------------------------------------------------- steps

    def step_started(self, step_name: str) -> str:
        """
        Emit STEP_STARTED — used to mark a sub-agent or multi-phase workflow step.
        Frontend renders this as an activity indicator in the chat timeline.
        """
        return self.encoder.encode(
            StepStartedEvent(type=EventType.STEP_STARTED, step_name=step_name)
        )

    def step_finished(self, step_name: str) -> str:
        return self.encoder.encode(
            StepFinishedEvent(type=EventType.STEP_FINISHED, step_name=step_name)
        )

    # ----------------------------------------------------------------- text

    def text_message_start(
        self,
        *,
        message_id: Optional[str] = None,
        role: str = "assistant",
    ) -> tuple[str, str]:
        """
        Emit TEXT_MESSAGE_START. Returns (sse_string, message_id) — callers must
        pass the returned message_id to subsequent `text_message_content` /
        `text_message_end` calls to group chunks into one message.
        """
        msg_id = message_id or self._next_message_id()
        sse = self.encoder.encode(
            TextMessageStartEvent(
                type=EventType.TEXT_MESSAGE_START,
                message_id=msg_id,
                role=role,
            )
        )
        return sse, msg_id

    def text_message_content(self, message_id: str, delta: str) -> str:
        return self.encoder.encode(
            TextMessageContentEvent(
                type=EventType.TEXT_MESSAGE_CONTENT,
                message_id=message_id,
                delta=delta,
            )
        )

    def text_message_end(self, message_id: str) -> str:
        return self.encoder.encode(
            TextMessageEndEvent(
                type=EventType.TEXT_MESSAGE_END,
                message_id=message_id,
            )
        )

    # ----------------------------------------------------------------- reasoning
    #
    # Reasoning events expose the model's internal "thinking" trace (Claude
    # extended thinking, OpenAI o1/o3 reasoning, DeepSeek R1, …) to the UI.
    # Our frontend hook (`useAIChat`) attaches reasoning to the next assistant
    # message as `message.reasoning` and the `ChatWidget` renders it as a
    # collapsible `<details>` block by default.
    #
    # Typical order (LLM-agnostic):
    #   reasoning_start → reasoning_message_start → reasoning_message_content×N
    #   → reasoning_message_end → reasoning_end → text_message_start → …
    #
    # You may emit multiple reasoning messages (chains of thought) inside a
    # single `reasoning_start / reasoning_end` pair.

    def reasoning_start(self, *, message_id: Optional[str] = None) -> tuple[str, str]:
        """
        Emit REASONING_START — marks the beginning of a reasoning block.
        Returns (sse_string, message_id). Pass the same message_id to
        `reasoning_message_*` calls inside this block.
        """
        msg_id = message_id or self._next_message_id()
        sse = self.encoder.encode(
            ReasoningStartEvent(
                type=EventType.REASONING_START,
                message_id=msg_id,
            )
        )
        return sse, msg_id

    def reasoning_end(self, message_id: str) -> str:
        return self.encoder.encode(
            ReasoningEndEvent(
                type=EventType.REASONING_END,
                message_id=message_id,
            )
        )

    def reasoning_message_start(
        self,
        *,
        message_id: Optional[str] = None,
    ) -> tuple[str, str]:
        """
        Emit REASONING_MESSAGE_START. The spec fixes role='reasoning'.
        Returns (sse_string, message_id).
        """
        msg_id = message_id or self._next_message_id()
        sse = self.encoder.encode(
            ReasoningMessageStartEvent(
                type=EventType.REASONING_MESSAGE_START,
                message_id=msg_id,
                role="reasoning",
            )
        )
        return sse, msg_id

    def reasoning_message_content(self, message_id: str, delta: str) -> str:
        return self.encoder.encode(
            ReasoningMessageContentEvent(
                type=EventType.REASONING_MESSAGE_CONTENT,
                message_id=message_id,
                delta=delta,
            )
        )

    def reasoning_message_end(self, message_id: str) -> str:
        return self.encoder.encode(
            ReasoningMessageEndEvent(
                type=EventType.REASONING_MESSAGE_END,
                message_id=message_id,
            )
        )

    # ----------------------------------------------------------------- tool calls

    def tool_call_start(
        self,
        tool_call_name: str,
        *,
        tool_call_id: Optional[str] = None,
        parent_message_id: Optional[str] = None,
    ) -> tuple[str, str]:
        """
        Emit TOOL_CALL_START. Returns (sse_string, tool_call_id).
        Use the returned id on subsequent `tool_call_args` / `tool_call_end` /
        `tool_call_result` calls for the same invocation.
        """
        call_id = tool_call_id or self._next_tool_call_id()
        sse = self.encoder.encode(
            ToolCallStartEvent(
                type=EventType.TOOL_CALL_START,
                tool_call_id=call_id,
                tool_call_name=tool_call_name,
                parent_message_id=parent_message_id,
            )
        )
        return sse, call_id

    def tool_call_args(self, tool_call_id: str, delta: str) -> str:
        """Stream partial JSON args as the LLM generates them (use raw string deltas)."""
        return self.encoder.encode(
            ToolCallArgsEvent(
                type=EventType.TOOL_CALL_ARGS,
                tool_call_id=tool_call_id,
                delta=delta,
            )
        )

    def tool_call_end(self, tool_call_id: str) -> str:
        return self.encoder.encode(
            ToolCallEndEvent(
                type=EventType.TOOL_CALL_END,
                tool_call_id=tool_call_id,
            )
        )

    def tool_call_result(
        self,
        tool_call_id: str,
        content: Any,
        *,
        message_id: Optional[str] = None,
        role: str = "tool",
    ) -> str:
        """Emit the tool's output AFTER the backend has actually executed the tool."""
        return self.encoder.encode(
            ToolCallResultEvent(
                type=EventType.TOOL_CALL_RESULT,
                tool_call_id=tool_call_id,
                content=content if isinstance(content, str) else str(content),
                message_id=message_id or self._next_message_id(),
                role=role,
            )
        )

    # ----------------------------------------------------------------- state

    def state_snapshot(self, snapshot: dict) -> str:
        """
        Replace the entire shared agent state. Use for initial sync.
        Frontend hook `useAIChat` exposes `state` reflecting this.
        """
        return self.encoder.encode(
            StateSnapshotEvent(type=EventType.STATE_SNAPSHOT, snapshot=snapshot)
        )

    def state_delta(self, delta: list[dict]) -> str:
        """
        Apply a JSON Patch delta (RFC 6902) to the shared state.
        Use for efficient incremental updates.
        """
        return self.encoder.encode(
            StateDeltaEvent(type=EventType.STATE_DELTA, delta=delta)
        )


AGUIHandler = Callable[[AGUIEmitter], AsyncIterator[str]]


def stream_response(
    input_data: RunAgentInput,
    handler: AGUIHandler,
    *,
    accept: Optional[str] = None,
    extra_headers: Optional[dict] = None,
) -> StreamingResponse:
    """
    Wrap an AG-UI handler into a FastAPI StreamingResponse with automatic
    RUN_STARTED / RUN_FINISHED / RUN_ERROR lifecycle events.

    The `handler` is an async generator that takes an `AGUIEmitter` and yields
    SSE strings. Lifecycle boilerplate is handled for you:

    - RUN_STARTED is emitted before the handler runs.
    - RUN_FINISHED is emitted when the handler completes without exceptions.
    - RUN_ERROR is emitted (with the exception message) if the handler raises,
      and the exception is NOT re-raised (it would interrupt the SSE stream).
      Instead, the error is logged and the stream ends cleanly.

    Nginx is configured by default in Coderblock preview/prod to not buffer SSE,
    so the `X-Accel-Buffering: no` header is a belt-and-suspenders addition.
    """
    emitter = AGUIEmitter(input_data, accept=accept)

    async def generate() -> AsyncIterator[str]:
        yield emitter.run_started()
        try:
            async for sse in handler(emitter):
                yield sse
        except Exception as exc:  # noqa: BLE001 — we must not break the stream
            import logging
            logging.getLogger(__name__).error(
                "AG-UI handler raised: %s", exc, exc_info=True
            )
            yield emitter.run_error(str(exc))
            return
        yield emitter.run_finished()

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    if extra_headers:
        headers.update(extra_headers)

    return StreamingResponse(
        generate(),
        media_type=accept or "text/event-stream",
        headers=headers,
    )


def is_frontend_tool(tool_name: str, input_data: RunAgentInput) -> bool:
    """
    Check whether a tool was declared by the frontend (HITL pattern).

    When the LLM invokes a tool whose name matches one declared in
    `input_data.tools`, the backend must NOT execute it — the frontend's
    `useAIChat` hook will handle it (via a registered `frontendTools` entry)
    and reply with the result as a `role: 'tool'` message on the next POST.

    Use in your service/orchestrator:

        for call in assistant_msg.tool_calls:
            if is_frontend_tool(call.function.name, input_data):
                sse, tc_id = emit.tool_call_start(call.function.name,
                                                  tool_call_id=call.id)
                yield sse
                yield emit.tool_call_args(tc_id, call.function.arguments)
                yield emit.tool_call_end(tc_id)
                return  # run ends; frontend resumes with the tool result
            else:
                result = await execute_backend_tool(call)
                yield emit.tool_call_result(tc_id, result)
    """
    tools = getattr(input_data, "tools", None) or []
    return any(getattr(t, "name", None) == tool_name for t in tools)


async def parse_run_input(request: Request) -> RunAgentInput:
    """
    Permissive dependency that parses an AG-UI `RunAgentInput` from the request
    body and normalizes the most common client-side omissions so that a minimal,
    well-meaning payload like

        {"thread_id": "t1",
         "run_id": "r1",
         "messages": [{"role": "user", "content": "Hi"}]}

    still passes Pydantic validation (the raw `ag_ui.core.RunAgentInput` model
    requires `id` on every message, non-null `state`, plus `tools` / `context` /
    `forwarded_props`). This is the FIRST line of defense against hand-written
    frontend clients that skip our `useAIChat` hook — which should be the
    exception, not the rule, but does happen.

    Normalizations applied (all idempotent):

    - Every message gets an `id` (UUID4 hex) if missing.
    - Tool messages also get a `tool_call_id` fallback (rare, but Pydantic
      requires it and some minimal clients omit it).
    - `tools` / `context` default to `[]`.
    - `forwarded_props` / `forwardedProps` default to `{}`.
    - `state` defaults to `{}` when missing OR explicitly `null` (a common bug
      — many clients send `state: null` instead of `state: {}`).
    - `thread_id` / `run_id` auto-generated if missing (debatable but keeps
      dev-mode / curl tests working; the `useAIChat` hook always populates
      them so real clients are unaffected).

    Usage:

        from fastapi import APIRouter, Depends
        from core.ag_ui_emitter import parse_run_input, stream_response

        router = APIRouter(prefix="/ai_chatbot")

        @router.post("/run")
        async def run(input_data: RunAgentInput = Depends(parse_run_input)):
            async def handler(emit):
                ...
            return stream_response(input_data, handler)

    On validation failure returns 422 with the original Pydantic error detail,
    so the client still gets actionable feedback for truly malformed payloads.
    """
    try:
        body = await request.json()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {exc}")

    if not isinstance(body, dict):
        raise HTTPException(
            status_code=422,
            detail="Expected a JSON object for AG-UI RunAgentInput",
        )

    body.setdefault("thread_id", f"thread_{uuid.uuid4().hex}")
    body.setdefault("run_id", f"run_{uuid.uuid4().hex}")
    body.setdefault("tools", [])
    body.setdefault("context", [])
    if body.get("forwarded_props") is None and body.get("forwardedProps") is None:
        body["forwarded_props"] = {}
    if body.get("state") is None:
        body["state"] = {}

    messages = body.get("messages")
    if not isinstance(messages, list):
        raise HTTPException(
            status_code=422,
            detail="`messages` must be a list of AG-UI Message objects",
        )

    for msg in messages:
        if not isinstance(msg, dict):
            continue
        if not msg.get("id"):
            msg["id"] = f"msg_{uuid.uuid4().hex}"
        if msg.get("role") == "tool" and not msg.get("tool_call_id"):
            msg["tool_call_id"] = f"tc_{uuid.uuid4().hex}"

    try:
        return RunAgentInput.model_validate(body)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors())


def has_tool_result(tool_call_id: str, input_data: RunAgentInput) -> bool:
    """
    True if `input_data.messages` already contains a `role: 'tool'` message
    answering the given tool_call_id — i.e. the frontend has provided the
    HITL result on a resumed run. Useful in the orchestrator loop to avoid
    re-emitting the tool call.
    """
    messages = getattr(input_data, "messages", None) or []
    for msg in messages:
        if getattr(msg, "role", None) != "tool":
            continue
        if getattr(msg, "tool_call_id", None) == tool_call_id:
            return True
    return False


__all__ = [
    "AGUIEmitter",
    "AGUIHandler",
    "stream_response",
    "parse_run_input",
    "is_frontend_tool",
    "has_tool_result",
]
