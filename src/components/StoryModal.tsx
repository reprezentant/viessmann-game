import type { StoryEvent, StoryChoice } from '../lib/story';

type Props = {
  event: StoryEvent | null;
  onChoose: (choice: StoryChoice) => void;
  onClose: () => void;
};

export function StoryModal({ event, onChoose, onClose }: Props) {
  if (!event) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 420, maxWidth: '92vw', background: '#0f172a', color: '#e5e7eb', border: '1px solid #334155', borderRadius: 12, padding: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{event.title}</div>
        <div style={{ fontSize: 14, opacity: 0.9, lineHeight: 1.4, marginBottom: 12 }}>{event.text}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {event.choices.map((c) => (
            <button key={c.id} onClick={() => onChoose(c)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #475569', background: '#111827', color: '#e5e7eb', cursor: 'pointer' }}>
              {c.label}
            </button>
          ))}
          <button onClick={onClose} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #334155', background: '#0b1220', color: '#94a3b8', marginLeft: 'auto' }}>Zamknij</button>
        </div>
      </div>
    </div>
  );
}

export default StoryModal;
