import React from 'react';
import ViCoin from './ViCoin';

type Props = {
  image?: string | React.ReactNode;
  title: string;
  description?: string;
  reward?: string;
  onClick?: () => void;
  accent?: 'red' | 'emerald' | string;
  isDay?: boolean;
};

export default function MissionCard({ image, title, description, reward, onClick, accent, isDay = true }: Props) {
  const cardBg = isDay ? '#FFF7ED' : '#0f172a';
  const titleColor = isDay ? '#462A19' : '#e6e2ff';
  const descColor = isDay ? '#475569' : '#94a3b8';
  // allow an optional accent tint for the medallion border
  const accentBorder = (() => {
    const map: Record<string, string> = {
      emerald: 'rgba(16,185,129,0.18)',
      red: 'rgba(249,115,22,0.18)'
    };
    if (accent && typeof accent === 'string' && map[accent]) return map[accent];
    return 'rgba(245,158,11,0.12)';
  })();

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      onClick={onClick}
      onKeyDown={handleKey}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : -1}
      aria-label={title}
      style={{
        position: 'relative',
        display: 'flex',
  gap: 12,
  padding: '12px 16px 12px 72px', // slightly reduced left gutter for a bit less space
    borderRadius: 18,
    background: cardBg,
  border: isDay ? `2.5px solid rgba(245, 184, 135, 0.42)` : `2.5px solid rgba(99,102,241,0.08)`,
  boxShadow: '0 6px 20px rgba(15, 23, 42, 0.04)',
        alignItems: 'center',
        cursor: onClick ? 'pointer' : 'default',
        overflow: 'visible'
      }}
    >
      {/* left circular medallion */}
      <div style={{
        position: 'absolute',
  left: -10,
    top: '50%',
    transform: 'translateY(-50%)',
  width: 64,
  height: 64,
  borderTopLeftRadius: 0,
  borderBottomLeftRadius: 0,
  borderTopRightRadius: 999,
  borderBottomRightRadius: 999,
  background: isDay ? 'radial-gradient(circle at 30% 25%, #FFF7EE 0%, #FDE7C9 50%, #F0C9A0 100%)' : 'radial-gradient(circle at 30% 25%, #2b2443 0%, #3a3157 50%, #1e1a2b 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
  boxShadow: 'none',
        border: `2px solid ${accentBorder}`
      }}>
  {typeof image === 'string' ? <img src={image} alt={title} style={{ width: 60, height: 60, objectFit: 'contain', borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderTopRightRadius: 999, borderBottomRightRadius: 999, boxShadow: 'none', filter: 'none', background: 'transparent' }} /> : image}
      </div>

  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
  <div style={{ fontSize: 14, fontWeight: 600, color: titleColor }}>{title}</div>
  {description && <div style={{ color: descColor, fontSize: 12 }}>{description}</div>}

        {reward && (() => {
          const match = (reward || '').toString().match(/([+-]?\d+)/);
          const rewardLabel = match ? match[0] : (reward || '');
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <ViCoin size={16} />
              </span>
              <div style={{ color: '#059669', fontWeight: 700, fontSize: 12 }}>{rewardLabel}</div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
