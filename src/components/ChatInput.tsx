import { useState, useRef, useEffect } from 'react';
import { PHILOSOPHERS } from '../config';
// ChatInput: @mention autocomplete input component

interface ChatInputProps {
  onSend: (text: string) => void;
  isLoading: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, isLoading, placeholder }: ChatInputProps) {
  const [text, setText] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionRef = useRef<HTMLDivElement>(null);

  const filteredPhilosophers = PHILOSOPHERS.filter(p =>
    p.name.includes(mentionFilter) ||
    p.nameEn.toLowerCase().includes(mentionFilter.toLowerCase()) ||
    p.id.toLowerCase().includes(mentionFilter.toLowerCase())
  );

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setText(value);

    // Detect @mention
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPos);
    const lastAtPos = textBeforeCursor.lastIndexOf('@');

    if (lastAtPos >= 0) {
      const filterText = textBeforeCursor.slice(lastAtPos + 1);
      // Only show if filter doesn't contain space
      if (!filterText.includes(' ') && !filterText.includes('\n')) {
        setMentionFilter(filterText);
        setShowMentions(true);
        setSelectedIdx(0);
        return;
      }
    }
    setShowMentions(false);
  };

  const insertMention = (philosopherId: string) => {
    const philosopher = PHILOSOPHERS.find(p => p.id === philosopherId);
    if (!philosopher) return;

    const cursorPos = textareaRef.current?.selectionStart || 0;
    const textBeforeCursor = text.slice(0, cursorPos);
    const lastAtPos = textBeforeCursor.lastIndexOf('@');

    if (lastAtPos >= 0) {
      const newValue = text.slice(0, lastAtPos) + `@${philosopher.name} ` + text.slice(cursorPos);
      setText(newValue);
      setShowMentions(false);
      // Focus back to textarea
      setTimeout(() => {
        textareaRef.current?.focus();
        const newPos = lastAtPos + `@${philosopher.name} `.length;
        textareaRef.current?.setSelectionRange(newPos, newPos);
      }, 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx(prev => (prev + 1) % filteredPhilosophers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx(prev => (prev - 1 + filteredPhilosophers.length) % filteredPhilosophers.length);
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (filteredPhilosophers.length > 0) {
          insertMention(filteredPhilosophers[selectedIdx].id);
        }
        return;
      }
      if (e.key === 'Escape') {
        setShowMentions(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (!text.trim() || isLoading) return;
    onSend(text.trim());
    setText('');
    setShowMentions(false);
  };

  // Close mention dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (mentionRef.current && !mentionRef.current.contains(e.target as Node)) {
        setShowMentions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative border-t border-gray-200 bg-white px-4 py-3">
      {/* Mention dropdown */}
      {showMentions && filteredPhilosophers.length > 0 && (
        <div
          ref={mentionRef}
          className="absolute bottom-full left-4 right-4 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-50"
        >
          {filteredPhilosophers.map((p, i) => (
            <div
              key={p.id}
              className={`px-4 py-2 cursor-pointer flex items-center gap-2 ${
                i === selectedIdx ? 'bg-blue-50' : 'hover:bg-gray-50'
              }`}
              onClick={() => insertMention(p.id)}
              onMouseEnter={() => setSelectedIdx(i)}
            >
              <span className="text-lg">{p.emoji}</span>
              <div>
                <div className="font-medium text-sm">{p.name}</div>
                <div className="text-xs text-gray-500">{p.nameEn}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || "输入消息，按 Enter 发送，Shift+Enter 换行"}
            disabled={isLoading}
            rows={1}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm max-h-32"
            style={{ minHeight: '44px' }}
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!text.trim() || isLoading}
          className="px-5 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm flex items-center gap-1"
        >
          {isLoading ? (
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
          <span>{isLoading ? '发送中' : '发送'}</span>
        </button>
      </div>
    </div>
  );
}
