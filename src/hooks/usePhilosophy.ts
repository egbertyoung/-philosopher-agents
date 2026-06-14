import { useState, useCallback, useRef } from 'react';
import { Philosopher, PhilosophyMessage, PhilosopherSpeech, DiscussionMode } from '../types';

const API_BASE = '/api';

export function usePhilosophy() {
  const [philosophers, setPhilosophers] = useState<Philosopher[]>([]);
  const [messages, setMessages] = useState<PhilosophyMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentPhilosopher, setCurrentPhilosopher] = useState<string | null>(null);
  const abortRef = useRef<boolean>(false);

  // 获取哲学家列表
  const fetchPhilosophers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/philosophers`);
      const data = await res.json();
      setPhilosophers(data.philosophers || []);
    } catch (err) {
      console.error('获取哲学家列表失败:', err);
    }
  }, []);

  // 发起哲学讨论
  const discuss = useCallback(async (
    question: string,
    model: string,
    mode: DiscussionMode = 'moderated',
    philosopherId?: string
  ) => {
    if (!question.trim() || isLoading) return;

    setIsLoading(true);
    abortRef.current = false;

    // 添加用户消息
    const userMessageId = `user-${Date.now()}`;
    const discussionMessageId = `discussion-${Date.now()}`;

    const userMsg: PhilosophyMessage = {
      id: userMessageId,
      role: 'user',
      content: question,
      timestamp: new Date(),
    };

    const discussionMsg: PhilosophyMessage = {
      id: discussionMessageId,
      role: 'discussion',
      content: '',
      question,
      speeches: [],
      moderatorSummary: '',
      timestamp: new Date(),
      isStreaming: true,
    };

    setMessages(prev => [...prev, userMsg, discussionMsg]);

    try {
      const response = await fetch(`${API_BASE}/philosophy/discuss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          question,
          model,
          mode,
          philosopherId,
        }),
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // 跟踪当前哲学家的索引（用于流式追加内容）
      let currentPhilosopherIndex = -1;

      while (true) {
        if (abortRef.current) break;
        
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          
          try {
            const data = JSON.parse(line.slice(6));
            
            switch (data.type) {
              case 'init':
                if (data.sessionId) setSessionId(data.sessionId);
                break;

              case 'moderator_start':
                // 主持人开场
                break;

              case 'philosopher_start':
                // 新哲学家开始发言
                setCurrentPhilosopher(data.philosopherId);
                setMessages(prev => prev.map(msg => {
                  if (msg.id !== discussionMessageId) return msg;
                  const newSpeeches = [...(msg.speeches || []), {
                    philosopherId: data.philosopherId,
                    philosopherName: data.philosopherName,
                    philosopherEmoji: data.philosopherEmoji,
                    philosopherColor: data.philosopherColor,
                    content: '',
                    isStreaming: true,
                    isDone: false,
                  }];
                  currentPhilosopherIndex = newSpeeches.length - 1;
                  return { ...msg, speeches: newSpeeches };
                }));
                break;

              case 'philosopher_text':
                // 哲学家流式文本
                setMessages(prev => prev.map(msg => {
                  if (msg.id !== discussionMessageId) return msg;
                  const speeches = [...(msg.speeches || [])];
                  // 找到对应哲学家的最后一条发言
                  const idx = speeches.map(s => s.philosopherId).lastIndexOf(data.philosopherId);
                  if (idx >= 0) {
                    speeches[idx] = {
                      ...speeches[idx],
                      content: speeches[idx].content + data.content,
                      isStreaming: true,
                    };
                  }
                  return { ...msg, speeches };
                }));
                break;

              case 'philosopher_done':
                // 哲学家发言完毕
                setCurrentPhilosopher(null);
                setMessages(prev => prev.map(msg => {
                  if (msg.id !== discussionMessageId) return msg;
                  const speeches = [...(msg.speeches || [])];
                  const idx = speeches.map(s => s.philosopherId).lastIndexOf(data.philosopherId);
                  if (idx >= 0) {
                    speeches[idx] = {
                      ...speeches[idx],
                      isStreaming: false,
                      isDone: true,
                    };
                  }
                  return { ...msg, speeches };
                }));
                break;

              case 'moderator_summary_start':
                // 主持人开始总结
                break;

              case 'moderator_text':
                // 主持人总结流式文本
                setMessages(prev => prev.map(msg => {
                  if (msg.id !== discussionMessageId) return msg;
                  return {
                    ...msg,
                    moderatorSummary: (msg.moderatorSummary || '') + data.content,
                  };
                }));
                break;

              case 'done':
                // 讨论完成
                setMessages(prev => prev.map(msg => {
                  if (msg.id !== discussionMessageId) return msg;
                  return { ...msg, isStreaming: false };
                }));
                setIsLoading(false);
                break;

              case 'error':
                console.error('讨论错误:', data.message);
                setMessages(prev => prev.map(msg => {
                  if (msg.id !== discussionMessageId) return msg;
                  return {
                    ...msg,
                    isStreaming: false,
                    content: `错误: ${data.message}`,
                  };
                }));
                setIsLoading(false);
                break;
            }
          } catch (parseErr) {
            // 忽略解析错误
          }
        }
      }
    } catch (err: any) {
      console.error('讨论请求失败:', err);
      setMessages(prev => prev.map(msg => {
        if (msg.role !== 'discussion' || !msg.isStreaming) return msg;
        return { ...msg, isStreaming: false, content: `请求失败: ${err.message}` };
      }));
    } finally {
      setIsLoading(false);
      setCurrentPhilosopher(null);
    }
  }, [isLoading, sessionId]);

  // 清空讨论
  const clearDiscussion = useCallback(() => {
    setMessages([]);
    setSessionId(null);
  }, []);

  // 停止讨论
  const stopDiscussion = useCallback(() => {
    abortRef.current = true;
    setIsLoading(false);
    setCurrentPhilosopher(null);
    setMessages(prev => prev.map(msg => {
      if (msg.isStreaming) return { ...msg, isStreaming: false };
      return msg;
    }));
  }, []);

  return {
    philosophers,
    messages,
    isLoading,
    currentPhilosopher,
    fetchPhilosophers,
    discuss,
    clearDiscussion,
    stopDiscussion,
  };
}
