import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

type Step = { key: string; ms?: number };

export default function VideoIntro({ 
  onComplete,
  steps,
  minTotalMs = 2000
}: { 
  onComplete: () => void;
  steps: Step[];
  minTotalMs?: number;
}) {
  const { t } = useTranslation('ui');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [canSkip, setCanSkip] = useState(false);
  const [loadingIndex, setLoadingIndex] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);

  const total = steps.length;
  const current = steps[Math.min(loadingIndex, total - 1)];
  const currentLabel = t(`loader.${current?.key}`, { defaultValue: current?.key || '' });

  // Loading simulation
  useEffect(() => {
    let cancelled = false;
    const perStepMs = steps.map(s => s.ms ?? Math.ceil(minTotalMs / total));

    const run = async () => {
      for (let i = 0; i < total; i++) {
        if (cancelled) return;
        setLoadingIndex(i);
        const duration = perStepMs[i] || 0;
        const start = performance.now();
        
        await new Promise<void>((resolve) => {
          const tick = () => {
            if (cancelled) return resolve();
            const elapsed = performance.now() - start;
            const stepProgress = Math.min(1, elapsed / Math.max(1, duration));
            const overall = (i + stepProgress) / total;
            setLoadingProgress(Math.round(overall * 100));
            if (stepProgress >= 1) resolve();
            else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
      }
      if (!cancelled) {
        setLoadingProgress(100);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [steps, total, minTotalMs]);

  useEffect(() => {
    // Allow skipping after 1 second
    const skipTimer = setTimeout(() => setCanSkip(true), 1000);
    return () => clearTimeout(skipTimer);
  }, []);

  const handleVideoEnd = () => {
    onComplete();
  };

  const handleSkip = () => {
    if (canSkip) {
      onComplete();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3000,
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #2d1810 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
      }}
      onClick={handleSkip}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        onEnded={handleVideoEnd}
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
        }}
      >
        <source src="/src/assets/Intro.mp4" type="video/mp4" />
      </video>

      {/* Loading overlay on video */}
      <div
        style={{
          position: 'absolute',
          bottom: '15%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(90vw, 500px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* Loading text */}
        <div
          style={{
            color: '#fff',
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: 2,
            textTransform: 'uppercase',
            textAlign: 'center',
            opacity: 0.95,
            textShadow: '0 2px 8px rgba(0,0,0,0.8)',
          }}
        >
          {t('loader.loading')}
        </div>

        {/* Progress bar */}
        <div
          style={{
            height: 8,
            background: 'rgba(0,0,0,0.5)',
            borderRadius: 999,
            border: '1px solid rgba(255,255,255,0.3)',
            overflow: 'hidden',
            boxShadow: '0 2px 12px rgba(0,0,0,0.6)',
          }}
        >
          <div
            style={{
              width: `${loadingProgress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #f59e0b, #fb923c, #fbbf24)',
              transition: 'width 300ms ease-out',
              boxShadow: '0 0 12px rgba(245, 158, 11, 0.6)',
              border: '1px solid rgba(251, 191, 36, 0.4)',
              borderRadius: 999,
            }}
          />
        </div>

        {/* Step info */}
        <div
          style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.85)',
            textAlign: 'center',
            textShadow: '0 1px 4px rgba(0,0,0,0.8)',
          }}
        >
          {t('loader.step', { current: Math.min(loadingIndex + 1, total), total })}: {currentLabel}
        </div>
      </div>

      {/* Skip hint */}
      {canSkip && (
        <div
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            color: '#fff',
            fontSize: 13,
            opacity: 0.7,
            cursor: 'pointer',
            padding: '8px 12px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: 8,
            backdropFilter: 'blur(4px)',
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        >
          {t('loader.clickToSkip')}
        </div>
      )}
    </div>
  );
}
