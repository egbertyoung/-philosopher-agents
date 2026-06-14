import React from 'react';
import { Philosopher } from '../types';

interface PhilosopherCardProps {
  philosopher: Philosopher;
  isActive?: boolean;
  isStreaming?: boolean;
  onClick?: () => void;
  compact?: boolean;
}

export function PhilosopherCard({ philosopher, isActive, isStreaming, onClick, compact }: PhilosopherCardProps) {
  if (compact) {
    return (
      <div
        className={`philosopher-card-compact ${isActive ? 'active' : ''} ${onClick ? 'clickable' : ''}`}
        onClick={onClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          borderRadius: '8px',
          border: `2px solid ${isActive ? philosopher.color : '#e5e7eb'}`,
          background: isActive ? `${philosopher.color}15` : 'white',
          cursor: onClick ? 'pointer' : 'default',
          transition: 'all 0.2s',
        }}
      >
        <span style={{ fontSize: '20px' }}>{philosopher.emoji}</span>
        <div>
          <div style={{ fontWeight: 600, fontSize: '14px', color: isActive ? philosopher.color : '#374151' }}>
            {philosopher.name}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af' }}>{philosopher.era}</div>
        </div>
        {isStreaming && (
          <div className="streaming-dot" style={{ marginLeft: 'auto' }}>
            <span style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: philosopher.color,
              animation: 'pulse 1s infinite',
            }} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`philosopher-card ${isActive ? 'active' : ''}`}
      onClick={onClick}
      style={{
        padding: '16px',
        borderRadius: '12px',
        border: `2px solid ${isActive ? philosopher.color : '#e5e7eb'}`,
        background: isActive ? `${philosopher.color}10` : 'white',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s',
        boxShadow: isActive ? `0 4px 12px ${philosopher.color}30` : '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: `${philosopher.color}20`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
        }}>
          {philosopher.emoji}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '16px', color: philosopher.color }}>
            {philosopher.name}
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            {philosopher.nameEn} · {philosopher.origin}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af' }}>{philosopher.era}</div>
        </div>
      </div>
      <p style={{ fontSize: '13px', color: '#4b5563', marginBottom: '8px', lineHeight: 1.5 }}>
        {philosopher.description}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {philosopher.keyPhilosophies.slice(0, 3).map(tag => (
          <span key={tag} style={{
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '11px',
            background: `${philosopher.color}15`,
            color: philosopher.color,
            border: `1px solid ${philosopher.color}30`,
          }}>
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
