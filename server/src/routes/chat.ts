import { Router, type Request, type Response } from 'express';
import { ChatService, CHAT_LIMITS, type ChatTurn } from '../services/chat/chatService.js';
import { AIProviderError } from '../services/ai/errors.js';

const router = Router();
const service = new ChatService();

function parseHistory(raw: unknown): { history: ChatTurn[]; error?: string } {
  if (raw === undefined || raw === null) return { history: [] };
  if (!Array.isArray(raw)) return { history: [], error: 'history must be an array.' };

  const history: ChatTurn[] = [];
  for (const item of raw.slice(-CHAT_LIMITS.maxHistoryTurns)) {
    const turn = item as { role?: unknown; content?: unknown };
    if ((turn?.role !== 'user' && turn?.role !== 'assistant') || typeof turn.content !== 'string') {
      return { history: [], error: "Each history entry needs role 'user' or 'assistant' and string content." };
    }
    history.push({ role: turn.role, content: turn.content });
  }
  return { history };
}

/**
 * POST /api/chat
 * Answers a question about the feedback workspace, grounded in stored analytics.
 */
router.post('/', async (req: Request, res: Response) => {
  const { message, history: rawHistory } = (req.body || {}) as { message?: unknown; history?: unknown };

  if (typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({ error: 'ValidationError', message: 'message must be a non-empty string.' });
    return;
  }
  if (message.length > CHAT_LIMITS.maxMessageChars) {
    res.status(400).json({
      error: 'ValidationError',
      message: `message must be at most ${CHAT_LIMITS.maxMessageChars} characters.`,
    });
    return;
  }

  const { history, error: historyError } = parseHistory(rawHistory);
  if (historyError) {
    res.status(400).json({ error: 'ValidationError', message: historyError });
    return;
  }

  try {
    const reply = await service.reply(message.trim(), history);
    res.status(200).json({ success: true, ...reply });
  } catch (err: unknown) {
    if (err instanceof AIProviderError) {
      const status = err.isRateLimit ? 429 : err.isTimeout ? 504 : 502;
      console.error(`[Chat API] AI provider error (${err.code}):`, err.message);
      res.status(status).json({
        error: 'AIProviderError',
        code: err.code,
        message: err.isRateLimit
          ? 'The AI provider is rate limiting requests. Please try again shortly.'
          : err.isTimeout
            ? 'The AI provider took too long to respond. Please try again.'
            : 'The AI provider could not complete the request.',
      });
      return;
    }
    console.error('[Chat API] Unexpected error:', err);
    res.status(500).json({ error: 'ChatError', message: 'Failed to generate a response.' });
  }
});

export default router;
