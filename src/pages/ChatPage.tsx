import { useEffect, useRef } from 'react';
import { usePhilosopherChat } from '../hooks/usePhilosopherChat';
import { ChatInput } from '../components/ChatInput';
import { ChatMessage } from '../components/ChatMessage';
import { PHILOSOPHERS } from '../config';

export function ChatPage() {
  const { messages, isLoading, sendMessage, sessionId } = usePhilosopherChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <span className="text-2xl">🏛️</span>
              哲学家对话
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              输入消息并 @ 提及哲学家，被提及的哲学家会依次回应你的问题
            </p>
          </div>
          <div className="flex items-center gap-3">
            {sessionId && (
              <span className="text-xs text-gray-400 font-mono">会话: {sessionId.slice(0, 8)}...</span>
            )}
            <div className="flex gap-1.5">
              {PHILOSOPHERS.map(p => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full"
                  style={{ backgroundColor: `${p.color}15`, color: p.color, border: `1px solid ${p.color}40` }}
                >
                  <span>{p.emoji}</span>
                  <span>{p.name}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <div className="text-6xl mb-4">💬</div>
            <h2 className="text-xl font-semibold mb-2">开始与哲学大师对话</h2>
            <p className="text-sm text-center max-w-md">
              在下方输入框中输入消息，使用 <code className="bg-gray-200 px-1 rounded">@</code> 提及哲学家。
              <br />
              例如：<code className="bg-gray-200 px-1 rounded">@亚里士多德 你认为什么是幸福？</code>
            </p>
            <div className="grid grid-cols-2 gap-3 mt-6 max-w-lg">
              {PHILOSOPHERS.map(p => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                >
                  <span className="text-2xl">{p.emoji}</span>
                  <div>
                    <div className="font-semibold text-sm text-gray-800">{p.name}</div>
                    <div className="text-xs text-gray-500">{p.era} · {p.origin}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          messages.map(m => (
            <ChatMessage key={m.id} message={m} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <ChatInput onSend={sendMessage} isLoading={isLoading} />
    </div>
  );
}
