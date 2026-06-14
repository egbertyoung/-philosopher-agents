import React, { useRef, useEffect } from 'react';
import { PhilosopherSpeech } from '../types';

interface PhilosopherSpeechBubbleProps {
  speech: PhilosopherSpeech;
}

// 简单的 markdown 转 HTML（只处理粗体和换行）
function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
}

export function PhilosopherSpeechBubble({ speech }: PhilosopherSpeechBubbleProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.innerHTML = renderMarkdown(speech.content);
    }
  }, [speech.content]);

  return (
    <div style={{
      marginBottom: '16px',
      animation: 'fadeInUp 0.3s ease-out',
    }}>
      {/* 哲学家头部 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px',
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          background: `${speech.philosopherColor}20`,
          border: `2px solid ${speech.philosopherColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px',
          flexShrink: 0,
        }}>
          {speech.philosopherEmoji}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontWeight: 700,
            fontSize: '15px',
            color: speech.philosopherColor,
          }}>
            {speech.philosopherName}
          </span>
          {speech.isStreaming && (
            <span style={{
              display: 'inline-flex',
              gap: '3px',
              alignItems: 'center',
            }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{
                  display: 'inline-block',
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  background: speech.philosopherColor,
                  animation: `bounce 1.4s infinite ease-in-out both`,
                  animationDelay: `${i * 0.16}s`,
                }} />
              ))}
            </span>
          )}
          {speech.isDone && (
            <span style={{ fontSize: '12px', color: '#9ca3af' }}>✓ 发言完毕</span>
          )}
        </div>
      </div>

      {/* 发言内容气泡 */}
      <div style={{
        marginLeft: '44px',
        padding: '12px 16px',
        borderRadius: '0 12px 12px 12px',
        background: `${speech.philosopherColor}08`,
        border: `1px solid ${speech.philosopherColor}20`,
        fontSize: '14px',
        lineHeight: 1.7,
        color: '#374151',
        position: 'relative',
      }}>
        {/* 左上角小三角 */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: '-8px',
          width: 0,
          height: 0,
          borderTop: `8px solid ${speech.philosopherColor}20`,
          borderLeft: '8px solid transparent',
        }} />
        <div ref={contentRef} />
        {speech.isStreaming && !speech.content && (
          <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>正在思考...</span>
        )}
      </div>
    </div>
  );
}
