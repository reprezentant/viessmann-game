import { useEffect, useMemo, useState } from 'react';

type Step = { key: string; label: string; ms?: number };

export default function LoadingOverlay({
  steps,
  onDone,
  minTotalMs = 1000,
}: {
  steps: Step[];
  onDone: () => void;
  minTotalMs?: number;
}) {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const total = steps.length;
  const current = steps[Math.min(index, total - 1)];

  // Calculate per-step duration so the whole sequence takes at least minTotalMs
  const perStepMs = useMemo(() => {
    const provided = steps.map(s => s.ms ?? 0).reduce((a, b) => a + b, 0);
    const remaining = Math.max(0, minTotalMs - provided);
    const auto = total > 0 ? Math.ceil(remaining / total) : 0;
    return steps.map(s => (s.ms ?? auto));
  }, [steps, total, minTotalMs]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      for (let i = 0; i < total; i++) {
        if (cancelled) return;
        setIndex(i);
        const duration = perStepMs[i] || 0;
        const start = performance.now();
        // animate progress within the step
        await new Promise<void>((resolve) => {
          const tick = () => {
            if (cancelled) return resolve();
            const elapsed = performance.now() - start;
            const stepProgress = Math.min(1, elapsed / Math.max(1, duration));
            const overall = (i + stepProgress) / total;
            setProgress(Math.round(overall * 100));
            if (stepProgress >= 1) resolve();
            else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
      }
      if (!cancelled) {
        setProgress(100);
        // small delay for polish
        setTimeout(onDone, 150);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [perStepMs, total, onDone]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'linear-gradient(135deg,#0f172a,#111827,#312e81)',
      color: '#E5E7EB',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{ width: 'min(92vw, 640px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 22 }}>🚀</span>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Ładowanie aplikacji</h1>
        </div>

        <div aria-label="postęp" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}
          style={{
            height: 10,
            background: '#1f2937',
            borderRadius: 999,
            border: '1px solid #334155',
            overflow: 'hidden',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.35)'
          }}
        >
          <div style={{
            width: `${progress}%`, height: '100%',
            background: 'linear-gradient(90deg,#22c55e,#06b6d4)',
            transition: 'width 120ms ease-out'
          }} />
        </div>

        <div style={{ marginTop: 12, fontSize: 14, color: '#cbd5e1' }}>
          <div style={{ opacity: 0.95 }}>Krok {Math.min(index + 1, total)} z {total}: {current?.label}</div>
        </div>

        <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
          {steps.map((s, i) => {
            const done = i < index;
            const active = i === index;
            return (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 18, textAlign: 'center' }}>{done ? '✓' : active ? '…' : '•'}</span>
                <span style={{ fontSize: 14, color: done ? '#9ca3af' : active ? '#e5e7eb' : '#94a3b8' }}>{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
