import type { StoryEvent, StoryChoice } from '../lib/story';

type Props = {
  event: StoryEvent | null;
  onChoose: (choice: StoryChoice) => void;
  onClose: () => void;
  isDay?: boolean;
};

export function StoryModal({ event, onChoose, onClose, isDay = true }: Props) {
  if (!event) return null;
  const bg = isDay ? 'white' : '#0f172a';
  const fg = isDay ? '#0f172a' : '#e5e7eb';
  const border = isDay ? '#e5e7eb' : '#334155';
  const btnBg = isDay ? '#f1f5f9' : '#111827';
  const btnBorder = isDay ? '#e5e7eb' : '#475569';
  const btnFg = isDay ? '#0f172a' : '#e5e7eb';
  const closeBg = isDay ? '#eef2f7' : '#0b1220';
  const closeFg = isDay ? '#64748b' : '#94a3b8';
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 460, maxWidth: '92vw', background: bg, color: fg, border: `1px solid ${border}`, borderRadius: 16, padding: 18, boxShadow: isDay ? '0 20px 40px rgba(0,0,0,0.12)' : '0 20px 40px rgba(0,0,0,0.5)' }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>{event.title}</div>
        <div style={{ fontSize: 14, opacity: 0.95, lineHeight: 1.5, marginBottom: 12 }}>{event.text}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {event.choices.map((c) => (
            <button key={c.id} onClick={() => onChoose(c)} style={{ padding: '8px 10px', borderRadius: 10, border: `1px solid ${btnBorder}`, background: btnBg, color: btnFg, cursor: 'pointer' }}>
              {c.label}
            </button>
          ))}
          <button onClick={onClose} style={{ padding: '8px 10px', borderRadius: 10, border: `1px solid ${border}`, background: closeBg, color: closeFg, marginLeft: 'auto', cursor: 'pointer' }}>Zamknij</button>
        </div>
      </div>
    </div>
  );
}

export default StoryModal;
