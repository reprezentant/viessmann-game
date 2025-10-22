import type { StoryChoice, StoryEvent } from '../lib/story';
import './events.css';

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
  return (
    <div
      className="events-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Centrum wydarzeń"
      onClick={(e) => {
        if (e.currentTarget === e.target) onClose();
      }}
    >
      <div
        className="events-modal"
        data-theme={isDay ? 'day' : 'night'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="events-modal__header">
          <div className="events-modal__title">Centrum wydarzeń</div>
          <button type="button" className="events-modal__close" onClick={onClose} aria-label="Zamknij">
            ✕
          </button>
        </div>
        {discount && (
          <section className="events-modal__discount">
            <div className="events-modal__discount-title">{discount.title}</div>
            <div className="events-modal__discount-subtitle">
              {discount.subtitle}
              {discount.meta && <span className="events-modal__discount-meta">• {discount.meta}</span>}
            </div>
          </section>
        )}
        {events.length === 0 ? (
          <div className="events-modal__empty">Brak oczekujących eventów. Wszystko pod kontrolą.</div>
        ) : (
          events.map((event) => (
            <article key={event.id} className="events-modal__event">
              <div className="events-modal__event-title">{event.title}</div>
              <p className="events-modal__event-text">{event.text}</p>
              <div className="events-modal__choices">
                {event.choices.map((choice) => (
                  <button
                    key={choice.id}
                    type="button"
                    className="events-modal__choice"
                    onClick={() => onChoose(event, choice)}
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
