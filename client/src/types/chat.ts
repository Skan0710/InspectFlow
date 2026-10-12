export type ChatRole = 'user' | 'assistant';

export type ChatMode = 'ai' | 'data_summary' | 'empty';

export interface ChatHistoryTurn {
  role: ChatRole;
  content: string;
}

export interface ChatResponse {
  success: boolean;
  answer: string;
  mode: ChatMode;
  provider?: string;
  model?: string;
  grounding: {
    totalFeedback: number;
    analyzedFeedback: number;
    issuesConsidered: number;
  };
  generatedAt: string;
}

export const CHAT_MAX_MESSAGE_CHARS = 1000;
