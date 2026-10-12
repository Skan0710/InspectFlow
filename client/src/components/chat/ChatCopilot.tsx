import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, Loader2, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import { sendChatMessage } from '../../api/client';
import { CHAT_MAX_MESSAGE_CHARS, type ChatMode } from '../../types/chat';

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  meta?: { mode: ChatMode; model?: string; analyzed: number; total: number };
}

const SUGGESTED_PROMPTS: Array<{ label: string; question: string }> = [
  { label: 'Biggest pain points', question: 'What are the biggest pain points?' },
  { label: 'Negative feedback summary', question: 'Summarize the negative feedback.' },
  { label: 'Priority issues', question: 'Which issues are highest priority?' },
  { label: 'Recommended actions', question: 'What actions do you recommend?' },
];

const MAX_HISTORY_TURNS = 6;

/** Renders **bold** and _italic_ spans without touching innerHTML. */
function renderInline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('_') && part.endsWith('_') && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

const MessageBody: React.FC<{ text: string }> = ({ text }) => (
  <div className="space-y-1.5 break-words">
    {text.split('\n').map((line, i) => {
      if (!line.trim()) return null;
      const bullet = /^(\s*)[-*]\s+(.*)$/.exec(line);
      if (bullet) {
        const nested = bullet[1].length >= 2;
        return (
          <div key={i} className={`flex gap-2 ${nested ? 'pl-4' : ''}`}>
            <span aria-hidden="true" className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-current opacity-60" />
            <span>{renderInline(bullet[2])}</span>
          </div>
        );
      }
      return <p key={i}>{renderInline(line)}</p>;
    })}
  </div>
);

export const ChatCopilot: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);

  const panelId = useId();
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const nextIdRef = useRef(1);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Keep the newest message in view
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isLoading, error, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const closePanel = useCallback(() => {
    setOpen(false);
    launcherRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closePanel]);

  const ask = useCallback(
    async (rawQuestion: string, options: { appendUser?: boolean } = {}) => {
      const question = rawQuestion.trim();
      if (!question || isLoading) return;
      const appendUser = options.appendUser ?? true;

      const history = messagesRef.current
        .slice(-MAX_HISTORY_TURNS)
        .map(({ role, content }) => ({ role, content }));

      setLastQuestion(question);
      setError(null);
      if (appendUser) {
        setMessages((prev) => [...prev, { id: nextIdRef.current++, role: 'user', content: question }]);
        setInput('');
      }
      setIsLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await sendChatMessage(question, history, controller.signal);
        setMessages((prev) => [
          ...prev,
          {
            id: nextIdRef.current++,
            role: 'assistant',
            content: res.answer,
            meta: {
              mode: res.mode,
              model: res.model,
              analyzed: res.grounding.analyzedFeedback,
              total: res.grounding.totalFeedback,
            },
          },
        ]);
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'The assistant could not respond.');
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setIsLoading(false);
      }
    },
    [isLoading]
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void ask(input);
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void ask(input);
    }
  };

  return (
    <>
      {open && (
        <section
          id={panelId}
          role="dialog"
          aria-label="InsightFlow AI Insights chat"
          className="fixed bottom-24 right-4 z-30 flex h-[min(34rem,calc(100dvh-11rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-2xl shadow-indigo-950/20 sm:right-6"
        >
          <header className="flex items-center justify-between gap-3 bg-gradient-to-r from-indigo-950 to-indigo-800 px-4 py-3 text-white">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
                <Sparkles className="h-4 w-4 text-indigo-200" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold leading-tight">AI Insights</h2>
                <p className="truncate text-[11px] leading-tight text-indigo-200">
                  Answers from your analyzed feedback
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={closePanel}
              aria-label="Minimize chat"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-indigo-100 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div
            ref={scrollRef}
            role="log"
            aria-live="polite"
            aria-label="Conversation"
            className="flex-1 space-y-3 overflow-y-auto bg-indigo-50/30 px-4 py-4"
            data-lenis-prevent
          >
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="rounded-xl border border-indigo-100 bg-white p-3 text-sm text-slate-700">
                  Ask about your customer feedback. Answers use only the analysis stored in this workspace.
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Try asking</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_PROMPTS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      disabled={isLoading}
                      onClick={() => void ask(p.question)}
                      className="rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] ${m.role === 'user' ? '' : 'w-full'}`}>
                  <div
                    className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'rounded-br-md bg-indigo-600 text-white'
                        : 'rounded-bl-md border border-indigo-100 bg-white text-slate-800'
                    }`}
                  >
                    {m.role === 'user' ? m.content : <MessageBody text={m.content} />}
                  </div>
                  {m.meta && m.meta.mode !== 'empty' && (
                    <p className="mt-1 px-1 text-[10px] text-slate-500">
                      {m.meta.mode === 'ai' ? `AI answer${m.meta.model ? ` · ${m.meta.model}` : ''}` : 'Stored metrics'}
                      {' · '}
                      based on {m.meta.analyzed.toLocaleString()} of {m.meta.total.toLocaleString()} reviews analyzed
                    </p>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-slate-500" role="status">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                Reviewing your feedback data…
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                <div className="flex-1">
                  <p>{error}</p>
                  {lastQuestion && (
                    <button
                      type="button"
                      onClick={() => void ask(lastQuestion, { appendUser: false })}
                      className="mt-1.5 inline-flex items-center gap-1 font-semibold text-rose-700 hover:text-rose-900"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Try again
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {messages.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-t border-indigo-100 bg-white px-3 py-2">
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  disabled={isLoading}
                  onClick={() => void ask(p.question)}
                  className="rounded-full border border-indigo-100 bg-indigo-50/60 px-2.5 py-1 text-[11px] font-medium text-indigo-700 transition-colors hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={onSubmit} className="flex items-end gap-2 border-t border-indigo-100 bg-white p-3">
            <label htmlFor={`${panelId}-input`} className="sr-only">
              Ask about your feedback
            </label>
            <textarea
              id={`${panelId}-input`}
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onInputKeyDown}
              rows={1}
              maxLength={CHAT_MAX_MESSAGE_CHARS}
              placeholder="Ask about your feedback…"
              className="max-h-28 min-h-[40px] flex-1 resize-none rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <button
              type="submit"
              disabled={isLoading || input.trim().length === 0}
              aria-label="Send message"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition-colors hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:cursor-not-allowed disabled:bg-indigo-300"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </section>
      )}

      <div className="group fixed bottom-5 right-4 z-40 sm:right-6">
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-lg bg-indigo-950 px-2.5 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
        >
          {open ? 'Minimize AI Insights' : 'Ask AI Insights'}
        </span>
        <button
          ref={launcherRef}
          type="button"
          onClick={() => (open ? closePanel() : setOpen(true))}
          aria-label={open ? 'Minimize AI Insights chat' : 'Open AI Insights chat'}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-lg shadow-indigo-900/30 ring-1 ring-white/20 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 motion-safe:hover:scale-105 motion-safe:active:scale-95"
        >
          {open ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
        </button>
      </div>
    </>
  );
};
