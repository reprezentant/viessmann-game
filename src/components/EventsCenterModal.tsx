import type { StoryChoice, StoryEvent } from '../lib/story';

type DiscountSummary = {
  title: string;
  subtitle: string;
  meta?: string;
} | null;

type Props = {
  open: boolean;
  events: StoryEvent[];
  discount: DiscountSummary;
  onClose: () => void;
  onChoose: (event: StoryEvent, choice: StoryChoice) => void;
  isDay?: boolean;
};

export default function EventsCenterModal({ open, events, discount, onClose, onChoose, isDay = true }: Props) {
  if (!open) return null;
  const bg = isDay ? '#ffffff' : '#0f172a';
  const fg = isDay ? '#0f172a' : '#e5e7eb';
  const border = isDay ? '#e5e7eb' : '#334155';
  const muted = isDay ? '#475569' : '#94a3b8';
  const cardBg = isDay ? '#ffffff' : '#111827';
  const cardBorder = isDay ? '#e2e8f0' : '#1f2937';
  const ctaBg = isDay ? '#0ea5e9' : '#1d4ed8';
  const ctaHover = isDay ? '#0284c7' : '#1e40af';
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}
      onClick={(e) => {
        if (e.currentTarget === e.target) onClose();
      }}
    >
      <div
        style={{
          width: 560,
          maxWidth: '92vw',
          maxHeight: '80vh',
          overflowY: 'auto',
          background: bg,
          color: fg,
          border: `1px solid ${border}`,
          borderRadius: 18,
          padding: 20,
          boxShadow: isDay ? '0 20px 50px rgba(0,0,0,0.2)' : '0 24px 60px rgba(0,0,0,0.6)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 18, flex: 1 }}>Centrum wydarzeń</div>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', color: muted, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
            aria-label="Zamknij"
          >
            ✕
          </button>
        </div>
        {discount && (
          <div style={{ marginBottom: 16, padding: 14, borderRadius: 14, background: isDay ? '#f1f5f9' : '#111827', border: `1px solid ${cardBorder}` }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{discount.title}</div>
            <div style={{ color: muted }}>{discount.subtitle}{discount.meta ? ` • ${discount.meta}` : ''}</div>
          </div>
        )}
        {events.length === 0 ? (
          <div style={{ padding: 20, borderRadius: 14, border: `1px dashed ${border}`, background: isDay ? '#fafafa' : '#1e293b', color: muted }}>
            Brak oczekujących eventów. Wszystko pod kontrolą.
          </div>
        ) : (
          events.map((event) => (
            <div key={event.id} style={{ marginBottom: 16, padding: 16, borderRadius: 14, background: cardBg, border: `1px solid ${cardBorder}` }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{event.title}</div>
              <div style={{ fontSize: 13, color: muted, margin: '8px 0 12px' }}>{event.text}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {event.choices.map((choice) => (
                  <button
                    key={choice.id}
                    onClick={() => onChoose(event, choice)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 10,
                      border: 'none',
                      background: ctaBg,
                      color: '#ffffff',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = ctaHover; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = ctaBg; }}
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
