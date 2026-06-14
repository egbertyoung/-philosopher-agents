import React, { useState, useRef, useEffect } from 'react';
import { PhilosophyMessage, Philosopher, DiscussionMode } from '../types';
import { PhilosopherSpeechBubble } from './PhilosopherSpeechBubble';
import { PhilosopherCard } from './PhilosopherCard';

interface PhilosophyDiscussionProps {
  messages: PhilosophyMessage[];
  philosophers: Philosopher[];
  isLoading: boolean;
  currentPhilosopher: string | null;
  onAsk: (question: string, mode: DiscussionMode, philosopherId?: string) => void;
  onClear: () => void;
  onStop: () => void;
  model: string;
}

const SAMPLE_QUESTIONS = [
  '什么是真正的幸福？',
  '人性本善还是本恶？',
  '死亡是终结还是转化？',
  '知识的本质是什么？',
  '国家的目的是什么？',
  '自由与秩序如何平衡？',
];

export function PhilosophyDiscussion({
  messages,
  philosophers,
  isLoading,
  currentPhilosopher,
  onAsk,
  onClear,
  onStop,
  model,
}: PhilosophyDiscussionProps) {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<DiscussionMode>('moderated');
  const [selectedPhilosopher, setSelectedPhilosopher] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const question = input.trim();
    setInput('');
    onAsk(question, mode, mode === 'single' ? selectedPhilosopher : undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f9fafb' }}>
      {/* 模式选择栏 */}
      <div style={{
        padding: '12px 20px',
        background: 'white',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500 }}>讨论模式：</span>
          <button
            onClick={() => setMode('moderated')}
            style={{
              padding: '4px 12px',
              borderRadius: '20px',
              border: `2px solid ${mode === 'moderated' ? '#6366f1' : '#e5e7eb'}`,
              background: mode === 'moderated' ? '#6366f115' : 'white',
              color: mode === 'moderated' ? '#6366f1' : '#6b7280',
              fontSize: '13px',
              fontWeight: mode === 'moderated' ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            🎭 群贤共论
          </button>
          <button
            onClick={() => setMode('single')}
            style={{
              padding: '4px 12px',
              borderRadius: '20px',
              border: `2px solid ${mode === 'single' ? '#6366f1' : '#e5e7eb'}`,
              background: mode === 'single' ? '#6366f115' : 'white',
              color: mode === 'single' ? '#6366f1' : '#6b7280',
              fontSize: '13px',
              fontWeight: mode === 'single' ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            💬 独对哲人
          </button>
        </div>

        {/* 单哲学家模式下的选择 */}
        {mode === 'single' && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {philosophers.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedPhilosopher(p.id)}
                style={{
                  padding: '3px 10px',
                  borderRadius: '16px',
                  border: `2px solid ${selectedPhilosopher === p.id ? p.color : '#e5e7eb'}`,
                  background: selectedPhilosopher === p.id ? `${p.color}15` : 'white',
                  color: selectedPhilosopher === p.id ? p.color : '#6b7280',
                  fontSize: '12px',
                  fontWeight: selectedPhilosopher === p.id ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span>{p.emoji}</span>
                <span>{p.name}</span>
              </button>
            ))}
          </div>
        )}

        {messages.length > 0 && (
          <button
            onClick={onClear}
            style={{
              marginLeft: 'auto',
              padding: '4px 12px',
              borderRadius: '6px',
              border: '1px solid #e5e7eb',
              background: 'white',
              color: '#6b7280',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            清空讨论
          </button>
        )}
      </div>

      {/* 消息区域 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {isEmpty ? (
          <div style={{ textAlign: 'center', paddingTop: '40px' }}>
            {/* 哲学家展示 */}
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', marginBottom: '8px' }}>
                🏛️ 哲学家多Agent讨论系统
              </h2>
              <p style={{ color: '#6b7280', fontSize: '14px' }}>
                邀请亚里士多德、孔子、黑格尔、庄子四位哲学大师，共同探讨人类智慧的终极问题
              </p>
            </div>

            {/* 四位哲学家卡片 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
              maxWidth: '900px',
              margin: '0 auto 32px',
            }}>
              {philosophers.map(p => (
                <PhilosopherCard
                  key={p.id}
                  philosopher={p}
                  onClick={() => {
                    setMode('single');
                    setSelectedPhilosopher(p.id);
                  }}
                />
              ))}
            </div>

            {/* 示例问题 */}
            <div>
              <p style={{ color: '#9ca3af', fontSize: '13px', marginBottom: '12px' }}>💡 试试这些哲学问题：</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                {SAMPLE_QUESTIONS.map(q => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '20px',
                      border: '1px solid #d1d5db',
                      background: 'white',
                      color: '#4b5563',
                      fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => {
                      (e.target as HTMLButtonElement).style.borderColor = '#6366f1';
                      (e.target as HTMLButtonElement).style.color = '#6366f1';
                    }}
                    onMouseLeave={e => {
                      (e.target as HTMLButtonElement).style.borderColor = '#d1d5db';
                      (e.target as HTMLButtonElement).style.color = '#4b5563';
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            {messages.map(msg => (
              <div key={msg.id} style={{ marginBottom: '24px' }}>
                {msg.role === 'user' ? (
                  /* 用户提问 */
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                    <div style={{
                      maxWidth: '70%',
                      padding: '12px 16px',
                      borderRadius: '12px 12px 4px 12px',
                      background: '#6366f1',
                      color: 'white',
                      fontSize: '14px',
                      lineHeight: 1.6,
                    }}>
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  /* 哲学讨论 */
                  <div style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: '20px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                  }}>
                    {/* 问题标题 */}
                    {msg.question && (
                      <div style={{
                        fontSize: '13px',
                        color: '#9ca3af',
                        marginBottom: '16px',
                        paddingBottom: '12px',
                        borderBottom: '1px solid #f3f4f6',
                      }}>
                        🤔 正在讨论：<span style={{ color: '#4b5563', fontWeight: 500 }}>"{msg.question}"</span>
                      </div>
                    )}

                    {/* 哲学家发言列表 */}
                    {msg.speeches?.map((speech, idx) => (
                      <PhilosopherSpeechBubble key={`${speech.philosopherId}-${idx}`} speech={speech} />
                    ))}

                    {/* 加载中提示 */}
                    {msg.isStreaming && currentPhilosopher && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 0',
                        color: '#9ca3af',
                        fontSize: '13px',
                      }}>
                        <div style={{
                          display: 'inline-flex',
                          gap: '3px',
                        }}>
                          {[0, 1, 2].map(i => (
                            <span key={i} style={{
                              display: 'inline-block',
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: '#9ca3af',
                              animation: `bounce 1.4s infinite ease-in-out both`,
                              animationDelay: `${i * 0.16}s`,
                            }} />
                          ))}
                        </div>
                        <span>正在等待更多哲学家发言...</span>
                      </div>
                    )}

                    {/* 主持人总结 */}
                    {msg.moderatorSummary && (
                      <div style={{
                        marginTop: '16px',
                        padding: '14px 16px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)',
                        border: '1px solid #6366f130',
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginBottom: '8px',
                          color: '#6366f1',
                          fontWeight: 600,
                          fontSize: '13px',
                        }}>
                          <span>🎓</span>
                          <span>主持人综合总结</span>
                          {msg.isStreaming && (
                            <span style={{
                              display: 'inline-flex',
                              gap: '2px',
                              marginLeft: '4px',
                            }}>
                              {[0, 1, 2].map(i => (
                                <span key={i} style={{
                                  display: 'inline-block',
                                  width: '4px',
                                  height: '4px',
                                  borderRadius: '50%',
                                  background: '#6366f1',
                                  animation: `bounce 1.4s infinite ease-in-out both`,
                                  animationDelay: `${i * 0.16}s`,
                                }} />
                              ))}
                            </span>
                          )}
                        </div>
                        <p style={{
                          fontSize: '13px',
                          color: '#4b5563',
                          lineHeight: 1.7,
                          margin: 0,
                        }}>
                          {msg.moderatorSummary}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 输入区域 */}
      <div style={{
        padding: '16px 20px',
        background: 'white',
        borderTop: '1px solid #e5e7eb',
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          {mode === 'single' && !selectedPhilosopher && (
            <div style={{
              padding: '8px 12px',
              marginBottom: '8px',
              borderRadius: '6px',
              background: '#fef3c7',
              color: '#92400e',
              fontSize: '12px',
            }}>
              ⚠️ 请先在上方选择一位哲学家进行单独对话
            </div>
          )}
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                mode === 'moderated'
                  ? '提出一个哲学问题，让四位大师共同探讨... (Enter 发送，Shift+Enter 换行)'
                  : selectedPhilosopher
                    ? `向${philosophers.find(p => p.id === selectedPhilosopher)?.name || '哲学家'}提问...`
                    : '请先选择一位哲学家...'
              }
              disabled={isLoading || (mode === 'single' && !selectedPhilosopher)}
              rows={2}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1.5px solid #e5e7eb',
                fontSize: '14px',
                resize: 'none',
                outline: 'none',
                fontFamily: 'inherit',
                lineHeight: 1.6,
                color: '#374151',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => { e.target.style.borderColor = '#6366f1'; }}
              onBlur={e => { e.target.style.borderColor = '#e5e7eb'; }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {isLoading ? (
                <button
                  type="button"
                  onClick={onStop}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '10px',
                    border: 'none',
                    background: '#ef4444',
                    color: 'white',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ⏹ 停止
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim() || (mode === 'single' && !selectedPhilosopher)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '10px',
                    border: 'none',
                    background: !input.trim() || (mode === 'single' && !selectedPhilosopher)
                      ? '#e5e7eb'
                      : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: !input.trim() || (mode === 'single' && !selectedPhilosopher) ? '#9ca3af' : 'white',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: !input.trim() || (mode === 'single' && !selectedPhilosopher) ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s',
                  }}
                >
                  发起讨论
                </button>
              )}
            </div>
          </form>
          <div style={{ marginTop: '6px', fontSize: '11px', color: '#9ca3af', textAlign: 'right' }}>
            {mode === 'moderated' ? '🎭 群贤共论模式：四位哲学家轮流发言' : '💬 独对哲人模式：专注与一位哲学家深度对话'}
          </div>
        </div>
      </div>
    </div>
  );
}
