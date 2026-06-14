import { PhilosophyMessage } from '../types';

interface ChatMessageProps {
  message: PhilosophyMessage;
  onReply?: (philosopherId: string, messageId: string) => void;
  selectedPhilosopherIds?: string[];
}

export function ChatMessage({ message, onReply, selectedPhilosopherIds }: ChatMessageProps) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[75%] bg-blue-600 text-white rounded-2xl px-4 py-3 text-sm leading-relaxed">
          {message.content}
        </div>
      </div>
    );
  }

  // Discussion message (philosopher responses)
  return (
    <div className="mb-4">
      {message.speeches?.map((speech, i) => (
        <div key={i} className="mb-3 ml-2">
          {/* Philosopher header */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-base">{speech.philosopherEmoji}</span>
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded"
              style={{ backgroundColor: `${speech.philosopherColor}20`, color: speech.philosopherColor }}
            >
              {speech.philosopherName}
            </span>
            {speech.isStreaming && !speech.isDone && (
              <span className="text-xs text-gray-400">思考中...</span>
            )}

            {/* 回复按钮：仅在完成且有 onReply 回调时显示 */}
            {!speech.isStreaming && speech.isDone && onReply && (
              <button
                onClick={() => onReply(speech.philosopherId, message.id)}
                className="text-xs text-blue-500 hover:text-blue-700 ml-auto"
                title="让其他哲学家回复这段回答"
              >
                ↩️ 让TA回复
              </button>
            )}
          </div>

          {/* Speech content */}
          <div className="ml-7 bg-gray-50 rounded-xl px-4 py-3 text-sm leading-relaxed text-gray-800 border border-gray-100">
            {speech.content || (speech.isStreaming ? (
              <span className="inline-block w-2 h-4 bg-gray-400 rounded animate-pulse" />
            ) : (
              <span className="text-gray-400 italic">等待回复...</span>
            ))}

            {speech.isStreaming && speech.content && (
              <span className="inline-block w-2 h-4 bg-gray-400 rounded animate-pulse ml-1" />
            )}
          </div>
        </div>
      ))}

      {/* Loading state for new speeches */}
      {message.isStreaming && (!message.speeches || message.speeches.length === 0) && (
        <div className="flex items-center gap-2 text-gray-400 text-sm ml-2">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
          </div>
          <span>哲学大师们正在思考...</span>
        </div>
      )}
    </div>
  );
}
