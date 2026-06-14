import { useState, useCallback, useRef } from 'react';
import { PhilosopherSpeech, PhilosophyMessage } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

export interface SendOptions {
  selectedPhilosopherIds?: string[];
  replyToMessageId?: string;
}

export function usePhilosopherChat() {
  const [messages, setMessages] = useState<PhilosophyMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (
    text: string,
    options: SendOptions = {}
  ) => {
    if ((!text.trim() && !options.replyToMessageId) || isLoading) return;

    setIsLoading(true);
    const userMsg: PhilosophyMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      question: text,
      speeches: [],
      timestamp: new Date(),
      isStreaming: false,
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const body: any = {
        message: text,
        mode: 'chat',
        sessionId,
        selectedPhilosopherIds: options.selectedPhilosopherIds || [],
        replyToMessageId: options.replyToMessageId || undefined,
      };

      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch(`${API_BASE}/api/philosophy/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '请求失败');
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('无响应流');

      const decoder = new TextDecoder();
      let buffer = '';
      let currentMsg: PhilosophyMessage | null = null;
      let speechesMap: Record<string, PhilosopherSpeech> = {};

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const dataStr = trimmed.slice(6).trim();
          if (dataStr === '[DONE]') continue;

          try {
            const data = JSON.parse(dataStr);

            if (data.type === 'init') {
              setSessionId(data.sessionId);
              currentMsg = {
                id: data.userMessageId || `msg-${Date.now()}`,
                role: 'discussion',
                content: '',
                question: text,
                speeches: [],
                timestamp: new Date(),
                isStreaming: true,
              };
              speechesMap = {};
              setMessages(prev => [...prev, currentMsg!]);
            }

            if (data.type === 'philosopher_start') {
              const speech: PhilosopherSpeech = {
                philosopherId: data.philosopherId,
                philosopherName: data.philosopherName,
                philosopherEmoji: data.philosopherEmoji,
                philosopherColor: data.philosopherColor,
                content: '',
                isStreaming: true,
                isDone: false,
              };
              speechesMap[data.messageId || data.philosopherId] = speech;

              setMessages(prev => prev.map(m => {
                if (m.role === 'discussion' && m.isStreaming) {
                  return { ...m, speeches: [...(m.speeches || []), speech] };
                }
                return m;
              }));
            }

            if (data.type === 'philosopher_text') {
              const key = data.messageId || data.philosopherId;
              if (speechesMap[key]) {
                speechesMap[key].content += data.content;
              }

              setMessages(prev => prev.map(m => {
                if (m.role === 'discussion' && m.isStreaming) {
                  return {
                    ...m,
                    speeches: (m.speeches || []).map(s =>
                      s.philosopherId === data.philosopherId && s.isStreaming
                        ? { ...s, content: s.content + data.content }
                        : s
                    ),
                  };
                }
                return m;
              }));
            }

            if (data.type === 'philosopher_done' || data.type === 'philosopher_error') {
              const key = data.messageId || data.philosopherId;
              if (speechesMap[key]) {
                speechesMap[key].isStreaming = false;
                speechesMap[key].isDone = true;
              }

              setMessages(prev => prev.map(m => {
                if (m.role === 'discussion' && m.isStreaming) {
                  return {
                    ...m,
                    speeches: (m.speeches || []).map(s =>
                      s.philosopherId === data.philosopherId
                        ? { ...s, isStreaming: false, isDone: true }
                        : s
                    ),
                  };
                }
                return m;
              }));
            }

            if (data.type === 'moderator_summary') {
              setMessages(prev => prev.map(m =>
                m.role === 'discussion' && m.isStreaming
                  ? { ...m, moderatorSummary: data.summary }
                  : m
              ));
            }

            if (data.type === 'done') {
              setMessages(prev => prev.map(m =>
                m.role === 'discussion' && m.isStreaming
                  ? { ...m, isStreaming: false }
                  : m
              ));
              setIsLoading(false);
            }

            if (data.type === 'error') {
              setMessages(prev => prev.map(m =>
                m.role === 'discussion' && m.isStreaming
                  ? { ...m, isStreaming: false, content: `错误: ${data.message}` }
                  : m
              ));
              setIsLoading(false);
            }
          } catch (e) {
            // ignore parse errors
          }
        }
      }
    } catch (err: any) {
      console.error('[usePhilosopherChat] Error:', err);
      setMessages(prev => prev.map(m =>
        m.role === 'discussion' && m.isStreaming
          ? { ...m, isStreaming: false, content: `错误: ${err.message}` }
          : m
      ));
      setIsLoading(false);
    }
  }, [isLoading, sessionId]);

  const exportSession = useCallback((sid: string) => {
    const url = `${API_BASE}/api/philosophy/export/${sid}`;
    window.open(url, '_blank');
  }, []);

  return { messages, isLoading, sendMessage, sessionId, exportSession };
}
