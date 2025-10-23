import type { StoryChoice, StoryEvent } from '../lib/story';
import './events.css';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation(['story', 'ui']);
  if (!open) return null;
  const tr = (keyOrText: string) => t(keyOrText, { ns: 'story', defaultValue: keyOrText });
  return (
    <div
      className="events-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t('events.altText', { ns: 'ui' })}
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
          <div className="events-modal__title">{t('eventsCenterTitle', { defaultValue: 'Centrum wydarzeń' })}</div>
          <button type="button" className="events-modal__close" onClick={onClose} aria-label={t('ui.close', { ns: 'ui' })}>
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
          <div className="events-modal__empty">{t('noPendingEvents', { defaultValue: 'Brak oczekujących eventów. Wszystko pod kontrolą.' })}</div>
        ) : (
          events.map((event) => (
            <article key={event.id} className="events-modal__event">
              <div className="events-modal__event-title">{tr(event.title)}</div>
              <p className="events-modal__event-text">{tr(event.text)}</p>
              <div className="events-modal__choices">
                {event.choices.map((choice) => (
                  <button
                    key={choice.id}
                    type="button"
                    className="events-modal__choice"
                    onClick={() => onChoose(event, choice)}
                  >
                    {tr(choice.label)}
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
