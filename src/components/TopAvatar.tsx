import React from 'react';

type Props = {
  imgSrc: string;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  size?: number;
  ringSize?: number;
  border?: string;
};

export default function TopAvatar({ imgSrc, title, isOpen, onToggle, size = 80, ringSize = 88, border }: Props) {
  const ringStyle: React.CSSProperties = {
    position: 'absolute',
    width: ringSize,
    height: ringSize,
    borderRadius: '50%',
    zIndex: 1
  };
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'visible' }}>
      <div style={ringStyle} />
      <button
        onClick={onToggle}
        title={title}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        style={{
          width: size,
          height: size,
          padding: 0,
          borderRadius: '50%',
          overflow: 'visible',
          border: isOpen ? '2px solid rgba(59,130,246,0.8)' : (border ?? '1px solid rgba(0,0,0,0.08)'),
          background: 'transparent',
          cursor: 'pointer',
          display: 'inline-block',
          position: 'relative',
          zIndex: 2
        }}
      >
        <img src={imgSrc} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: '50%' }} />
      </button>
    </div>
  );
}
