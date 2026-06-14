import { useEffect, useRef, useState, useCallback } from 'react';
import { usePhilosopherChat } from '../hooks/usePhilosopherChat';
import { ChatInput } from '../components/ChatInput';
import { ChatMessage } from '../components/ChatMessage';
import { PHILOSOPHERS } from '../config';

const ALL_IDS = ['aristotle', 'confucius', 'hegel', 'zhuangzi'];

export function ChatPage() {
  const { messages, isLoading, sendMessage, sessionId, exportSession } = usePhilosopherChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 当前选中的哲学家（底部按钮控制）
  const [selectedIds, setSelectedIds] = useState<string[]>(ALL_IDS);
  // 回复上下文：用户点击了"让TA回复"，等待选择回复者
  const [replyCtx, setReplyCtx] = useState<{
    messageId: string;
    philosopherId: string;
    philosopherName: string;
  } | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const togglePhilosopher = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSend = (text: string) => {
    // 回复模式下允许空消息（自动触发哲学家回复）
    if ((!text.trim() && !replyCtx) || isLoading) return;
    sendMessage(text.trim(), {
      selectedPhilosopherIds: selectedIds,
      replyToMessageId: replyCtx?.messageId || undefined,
    });
    setReplyCtx(null);
  };

  const handleReply = (philosopherId: string, messageId: string) => {
    const p = PHILOSOPHERS.find(x => x.id === philosopherId);
    setReplyCtx({ messageId, philosopherId, philosopherName: p?.name || philosopherId });
    // 清空已选，等用户选择回复者
    setSelectedIds([]);
  };

  const selectReplier = (id: string) => {
    // 用户选择了回复者，直接触发回复（空消息=自动触发）
    const msgId = replyCtx?.messageId;
    setSelectedIds([id]);
    setReplyCtx(null);
    sendMessage('', {
      selectedPhilosopherIds: [id],
      replyToMessageId: msgId,
    });
  };

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
              {replyCtx
                ? `↩️ 正在回复 ${replyCtx.philosopherName} — 请选择哪位哲学家来回重`
                : '选择哲学家，输入问题，开始跨时空对话'
              }
            </p>
          </div>
          <div className="flex items-center gap-3">
            {sessionId && (
              <button
                onClick={() => exportSession(sessionId)}
                className="text-xs px-3 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
                title="导出对话为 Markdown 文件"
              >
                📥 保存对话
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <div className="text-6xl mb-4">💬</div>
            <h2 className="text-xl font-semibold mb-2">选择哲学家，开始对话</h2>
            <p className="text-sm text-center max-w-md">
              点击下方哲学家头像选中/取消，选中后输入问题并发送。
              <br />
              哲学家回复后，点击 <span className="text-blue-500 font-medium">"让TA回复"</span> 让其他哲学家回应。
            </p>
            <div className="grid grid-cols-2 gap-3 mt-6 max-w-lg">
              {PHILOSOPHERS.map(p => (
                <div
                  key={p.id}
                  className={`flex items-center gap-3 p-3 bg-white rounded-xl border transition-all cursor-pointer ${
                    selectedIds.includes(p.id)
                      ? 'border-blue-400 shadow-md ring-1 ring-blue-200'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                  onClick={() => togglePhilosopher(p.id)}
                >
                  <span className="text-2xl">{p.emoji}</span>
                  <div>
                    <div className="font-semibold text-sm text-gray-800">{p.name}</div>
                    <div className="text-xs text-gray-500">{p.era} · {p.origin}</div>
                  </div>
                  {selectedIds.includes(p.id) && (
                    <span className="ml-auto text-blue-500 text-xs">✓</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          messages.map(m => (
            <ChatMessage
              key={m.id}
              message={m}
              onReply={handleReply}
              selectedPhilosopherIds={selectedIds}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply selector：点击"让TA回复"后，选择哪位哲学家来回重 */}
      {replyCtx && (
        <div className="px-4 py-3 bg-amber-50 border-t border-amber-200">
          <div className="text-sm text-amber-800 mb-2">
            ↩️ 让谁回复 <strong>{replyCtx.philosopherName}</strong> 的回答？
          </div>
          <div className="flex gap-2 flex-wrap">
            {PHILOSOPHERS.filter(p => p.id !== replyCtx.philosopherId).map(p => (
              <button
                key={p.id}
                onClick={() => selectReplier(p.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all shadow-sm"
                style={{ backgroundColor: `${p.color}20`, color: p.color, border: `1.5px solid ${p.color}` }}
              >
                <span>{p.emoji}</span>
                <span>{p.name}</span>
              </button>
            ))}
            <button
              onClick={() => { setReplyCtx(null); setSelectedIds(ALL_IDS); }}
              className="text-xs text-amber-600 hover:text-amber-800 px-2"
            >取消</button>
          </div>
        </div>
      )}

      {/* 底部：哲学家选择 + 输入框 */}
      <div className="border-t border-gray-200 bg-white px-4 py-3">
        {/* 哲学家切换按钮 */}
        {!replyCtx && (
          <div className="flex gap-2 mb-3 flex-wrap">
            {PHILOSOPHERS.map(p => (
              <button
                key={p.id}
                onClick={() => togglePhilosopher(p.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  selectedIds.includes(p.id)
                    ? 'shadow-sm'
                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                }`}
                style={
                  selectedIds.includes(p.id)
                    ? { backgroundColor: `${p.color}20`, color: p.color, border: `1.5px solid ${p.color}` }
                    : undefined
                }
              >
                <span>{p.emoji}</span>
                <span>{p.name}</span>
                {selectedIds.includes(p.id) && <span>✓</span>}
              </button>
            ))}
          </div>
        )}
        <ChatInput
          onSend={handleSend}
          isLoading={isLoading}
          placeholder={
            selectedIds.length === 0 && !replyCtx
              ? '请先选择至少一位哲学家 ↓'
              : replyCtx
                ? `回复 ${replyCtx.philosopherName}...`
                : `问 ${selectedIds.map(id => PHILOSOPHERS.find(p=>p.id===id)?.name).join('、')}...（Enter 发送）`
          }
        />
      </div>
    </div>
  );
}
