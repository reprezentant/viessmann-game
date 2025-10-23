import React from 'react';
import { useTranslation } from 'react-i18next';
import viCoin from '../assets/ui/ViCoin_LM.png';
import checkImg from '../assets/ui/Check.png';

type Props = {
  title: string;
  description: string;
  reward: string;
  imgSrc?: string | null;
  completed?: boolean;
  isDay?: boolean;
  // optional flags: if true, treat title/description as translation keys in 'missions' namespace
  titleIsKey?: boolean;
  descIsKey?: boolean;
};

const MissionCard: React.FC<Props> = ({ title, description, reward, imgSrc, completed, isDay = true, titleIsKey, descIsKey }) => {
  // need both namespaces: 'missions' for mission strings and 'ui' for small UI bits (alt text)
  const { t } = useTranslation(['missions', 'ui']);
  const containerStyle: React.CSSProperties = isDay ? {
    borderRadius: 18,
    padding: '12px 0',
    display: 'flex',
    gap: 0,
    alignItems: 'center',
    minHeight: 90,
    background: 'linear-gradient(160deg,#fff3da,#fde2b9,#f7d2a1)',
    color: '#4d2b14',
    border: '2px solid rgba(139,117,91,0.2)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    overflow: 'hidden'
  } : {
    borderRadius: 18,
    padding: '12px 0',
    display: 'flex',
    gap: 0,
    alignItems: 'center',
    minHeight: 90,
    background: 'linear-gradient(160deg,#2f2a3d,#262135,#1d192a)',
    color: '#e5e7eb',
    border: '2px solid rgba(148,163,184,0.2)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    overflow: 'hidden'
  };
  // if completed, modify border color to green
  if (completed) {
    (containerStyle as unknown as Record<string, string>)['border'] = '2px solid #7BB894';
  }

  const titleStyle: React.CSSProperties = {
    fontWeight: 800,
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

  const imgWrapperStyleBase: React.CSSProperties = {
    width: 64,
    height: 64,
    borderRadius: '0 12px 12px 0',
    overflow: 'hidden',
    flex: '0 0 64px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const imgWrapperStyle: React.CSSProperties = isDay ? {
    ...imgWrapperStyleBase,
    background: 'linear-gradient(160deg,#fff3da,#fde2b9,#f7d2a1)',
    borderTop: '2px solid rgba(139,117,91,0.3)',
    borderRight: '2px solid rgba(139,117,91,0.3)',
    borderBottom: '2px solid rgba(139,117,91,0.3)',
    borderLeft: 'none'
  } : {
    ...imgWrapperStyleBase,
    background: 'linear-gradient(160deg,#2f2a3d,#262135,#1d192a)',
    borderTop: '2px solid rgba(148,163,184,0.3)',
    borderRight: '2px solid rgba(148,163,184,0.3)',
    borderBottom: '2px solid rgba(148,163,184,0.3)',
    borderLeft: 'none'
  };
  if (completed) {
    (imgWrapperStyle as unknown as Record<string, string>)['borderRight'] = '3px solid #7BB894';
  }

  const renderTitle = () => {
    if (titleIsKey && typeof title === 'string') return t(title.replace(/^missions\./, ''), { ns: 'missions' });
    if (typeof title === 'string' && title.startsWith('missions.')) return t(title.replace(/^missions\./, ''), { ns: 'missions' });
    return title;
  };

  const renderDescription = () => {
    if (descIsKey && typeof description === 'string') return t(description.replace(/^missions\./, ''), { ns: 'missions' });
    if (typeof description === 'string' && description.startsWith('missions.')) return t(description.replace(/^missions\./, ''), { ns: 'missions' });
    return description;
  };

  return (
    <div style={containerStyle}>
      <div style={imgWrapperStyle}>
        {imgSrc ? (
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <img src={imgSrc} alt={typeof title === 'string' && titleIsKey ? t(String(title).replace(/^missions\./, ''), { ns: 'missions' }) : String(title)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            {completed && imgSrc !== checkImg && (
              <img src={checkImg} alt={t('ui:missions.completedAlt', { defaultValue: 'ukończone' })} style={{ position: 'absolute', right: -6, bottom: -6, width: 28, height: 28 }} />
            )}
          </div>
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDay ? '#fff' : '#2a233f' }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0, padding: '0 14px' }}>
  <div style={titleStyle}>{renderTitle()}{completed ? ' ✓' : ''}</div>
  <div style={descStyle}>{renderDescription()}</div>
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
          <img src={viCoin} alt="ViCoin" style={{ width: 16, height: 16 }} />
          <div style={{ fontWeight: 800, fontSize: 11 }}>{reward}</div>
        </div>
      </div>
    </div>
  );
};

export default MissionCard;
