import React, { useEffect, useState } from 'react';
import { usePhilosophy } from '../hooks/usePhilosophy';
import { PhilosophyDiscussion } from '../components/PhilosophyDiscussion';
import { DiscussionMode } from '../types';

const DEFAULT_MODEL = 'claude-sonnet-4';

export function PhilosophyPage() {
  const {
    philosophers,
    messages,
    isLoading,
    currentPhilosopher,
    fetchPhilosophers,
    discuss,
    clearDiscussion,
    stopDiscussion,
  } = usePhilosophy();

  const [model, setModel] = useState(DEFAULT_MODEL);
  const [models, setModels] = useState<Array<{ modelId: string; name: string }>>([]);

  useEffect(() => {
    fetchPhilosophers();
    
    // 获取模型列表
    fetch('/api/models')
      .then(r => r.json())
      .then(data => {
        if (data.models?.length) {
          setModels(data.models);
          setModel(data.defaultModel || DEFAULT_MODEL);
        }
      })
      .catch(() => {});
  }, [fetchPhilosophers]);

  const handleAsk = (question: string, mode: DiscussionMode, philosopherId?: string) => {
    discuss(question, model, mode, philosopherId);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* 顶部导航栏 */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)',
        color: 'white',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'rgba(255,255,255,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
          }}>
            🏛️
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 700, margin: 0, letterSpacing: '0.02em' }}>
              哲学家多Agent讨论系统
            </h1>
            <p style={{ fontSize: '12px', opacity: 0.7, margin: 0 }}>
              亚里士多德 · 孔子 · 黑格尔 · 庄子
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* 哲学家小头像 */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {['🏛️', '📜', '⚡', '🦋'].map((emoji, i) => (
              <div key={i} style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                border: '1px solid rgba(255,255,255,0.2)',
              }}>
                {emoji}
              </div>
            ))}
          </div>

          {/* 模型选择 */}
          <select
            value={model}
            onChange={e => setModel(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.3)',
              background: 'rgba(255,255,255,0.1)',
              color: 'white',
              fontSize: '12px',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {models.length > 0 ? (
              models.map(m => (
                <option key={m.modelId} value={m.modelId} style={{ background: '#312e81', color: 'white' }}>
                  {m.name}
                </option>
              ))
            ) : (
              <option value={DEFAULT_MODEL} style={{ background: '#312e81' }}>
                Claude Sonnet 4
              </option>
            )}
          </select>
        </div>
      </header>

      {/* 主内容区域 */}
      <main style={{ flex: 1, overflow: 'hidden' }}>
        <PhilosophyDiscussion
          messages={messages}
          philosophers={philosophers}
          isLoading={isLoading}
          currentPhilosopher={currentPhilosopher}
          onAsk={handleAsk}
          onClear={clearDiscussion}
          onStop={stopDiscussion}
          model={model}
        />
      </main>
    </div>
  );
}
