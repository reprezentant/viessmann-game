import React from 'react';
import viCoin from '../assets/ui/ViCoin_LM.png';
import checkImg from '../assets/ui/Check.png';

type Props = {
  title: string;
  description: string;
  reward: string;
  imgSrc?: string | null;
  completed?: boolean;
  isDay?: boolean;
};

const MissionCard: React.FC<Props> = ({ title, description, reward, imgSrc, completed, isDay = true }) => {
  const containerStyle: React.CSSProperties = isDay ? {
    borderRadius: 18,
    padding: 14,
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    background: 'linear-gradient(152deg, #fff5df 0%, #fde6c2 48%, #f7d2a1 100%)',
    color: '#4d2b14',
  border: '2px solid rgba(149,92,32,0.18)',
    boxShadow: '0 10px 22px rgba(78,48,20,0.12)'
  } : {
    borderRadius: 18,
    padding: 14,
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    background: 'linear-gradient(150deg, #2f2a3d 0%, #262135 50%, #1d192a 100%)',
    color: '#e8e6ff',
  border: '2px solid rgba(122,110,191,0.18)',
    boxShadow: '0 12px 28px rgba(4,6,14,0.45)'
  };
  // if completed, modify border color to green
  if (completed) {
    (containerStyle as unknown as Record<string, string>)['border'] = '2px solid #7BB894';
  }

  const titleStyle: React.CSSProperties = {
    fontWeight: 700,
    fontSize: 14,
    marginBottom: 4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  };

  const descStyle: React.CSSProperties = isDay ? {
    fontSize: 12,
    color: 'rgba(77,43,20,0.72)',
    lineHeight: 1.4,
    display: '-webkit-box',
    overflow: 'hidden'
  } : {
    fontSize: 12,
    color: 'rgba(226,223,255,0.78)',
    lineHeight: 1.4,
    display: '-webkit-box',
    overflow: 'hidden'
  };
  // add vendor props separately to satisfy TypeScript typings
  (descStyle as unknown as Record<string, string|number>)['WebkitLineClamp'] = 2;
  (descStyle as unknown as Record<string, string|number>)['WebkitBoxOrient'] = 'vertical';

  const imgWrapperStyle: React.CSSProperties = {
    width: 56,
    height: 56,
    borderRadius: '50%',
    overflow: 'hidden',
    flex: '0 0 56px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.04)'
  };

  return (
    <div style={containerStyle}>
      <div style={imgWrapperStyle}>
        {imgSrc ? (
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <img src={imgSrc} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            {completed && imgSrc !== checkImg && (
              <img src={checkImg} alt="ukończone" style={{ position: 'absolute', right: -6, bottom: -6, width: 28, height: 28 }} />
            )}
          </div>
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDay ? '#fff' : '#2a233f' }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={titleStyle}>{title}{completed ? ' ✓' : ''}</div>
        <div style={descStyle}>{description}</div>
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src={viCoin} alt="ViCoin" style={{ width: 18, height: 18 }} />
          <div style={{ fontWeight: 700, fontSize: 13 }}>{reward}</div>
        </div>
      </div>
    </div>
  );
};

export default MissionCard;
