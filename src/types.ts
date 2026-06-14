/**
 * 类型定义
 */

export type PermissionMode = 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions';

export interface Model {
  modelId: string;
  name: string;
  description?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input?: Record<string, unknown>;
  status: 'running' | 'completed' | 'error';
  result?: string;
  isError?: boolean;
}

/**
 * 内容块类型 - 支持文字和工具调用按顺序排列
 */
export type ContentBlock = 
  | { type: 'text'; text: string }
  | { type: 'tool_use'; toolCall: ToolCall };

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;  // 保留用于兼容，存储纯文本摘要
  model?: string;
  timestamp: Date;
  isStreaming?: boolean;
  toolCalls?: ToolCall[];  // 保留用于兼容
  contentBlocks?: ContentBlock[];  // 新增：按顺序排列的内容块
}

export interface Session {
  id: string;
  title: string;
  model: string;
  agentId?: string;
  cwd?: string;
  permissionMode?: PermissionMode;
  createdAt: Date;
  messages: Message[];
}

export interface CustomAgent {
  id: string;
  name: string;
  description?: string;
  systemPrompt: string;
  icon?: string;
  color?: string;
  permissionMode?: PermissionMode;
  createdAt: Date;
  updatedAt: Date;
}

// Agent 是 CustomAgent 的别名
export type Agent = CustomAgent;

export type Theme = 'light' | 'dark';

/**
 * 权限请求 - 用于工具调用确认
 */
export interface PermissionRequest {
  requestId: string;
  toolUseId: string;
  toolName: string;
  input: Record<string, unknown>;
  sessionId: string;
  timestamp: number;
}

/**
 * 权限响应
 */
export interface PermissionResponse {
  requestId: string;
  behavior: 'allow' | 'deny';
  message?: string;
}

/**
 * 哲学家配置
 */
export interface Philosopher {
  id: string;
  name: string;
  nameEn: string;
  era: string;
  origin: string;
  emoji: string;
  color: string;
  description: string;
  keyPhilosophies: string[];
}

/**
 * 哲学家发言片段
 */
export interface PhilosopherSpeech {
  philosopherId: string;
  philosopherName: string;
  philosopherEmoji: string;
  philosopherColor: string;
  content: string;
  isStreaming?: boolean;
  isDone?: boolean;
}

/**
 * 讨论模式
 */
export type DiscussionMode = 'moderated' | 'single';

/**
 * 哲学讨论消息
 */
export interface PhilosophyMessage {
  id: string;
  role: 'user' | 'discussion';
  content: string;
  question?: string;
  speeches?: PhilosopherSpeech[];
  moderatorSummary?: string;
  timestamp: Date;
  isStreaming?: boolean;
}
