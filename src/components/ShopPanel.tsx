import type { GameItem, ResourceState, ResKey } from '../types';
import { Tooltip } from './Tooltip';

interface ShopPanelProps {
  deviceItems: GameItem[];
  productionItems: GameItem[];
  resources: ResourceState;
  effectiveRates: Record<ResKey, number>;
  renewablesUnlocked: boolean;
  pendingPlacement: GameItem | null;
  onItemCancel: () => void;
  onPurchase: (item: GameItem) => void;
}

export function ShopPanel({
  deviceItems,
  productionItems,
  resources,
  effectiveRates,
  renewablesUnlocked,
  pendingPlacement,
  onItemCancel,
  onPurchase,
}: ShopPanelProps) {
  const fmt = (n: number) => {
    const abs = Math.abs(n);
    if (abs === 0) return '0';
    if (abs < 0.01) return n.toFixed(3);
    if (abs < 0.1) return n.toFixed(2);
    return n % 1 === 0 ? n.toString() : n.toFixed(1);
  };
  const rateText = (k: ResKey) => `+${fmt(effectiveRates[k])}/s`;

  const card: React.CSSProperties = {
    borderRadius: 16,
    background: "rgba(255,255,255,0.7)",
    padding: 12,
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
  };

  const btn = (active: boolean): React.CSSProperties => ({
    padding: "6px 12px",
    borderRadius: 999,
    fontSize: 13,
    border: "none",
    cursor: "pointer",
    background: active ? "#0a0a0a" : "#e5e5e5",
    color: active ? "#fff" : "#111",
  });

  const canAfford = (item: GameItem) => resources.coins >= item.price;
  const coinsRate = effectiveRates.coins ?? 0;

  const timeToAfford = (item: GameItem) => {
    if (canAfford(item)) return 0;
    const delta = item.price - resources.coins;
    if (coinsRate <= 0) return Infinity;
    return Math.max(0, delta / coinsRate);
  };

  const fmtTime = (seconds: number) => {
    if (!isFinite(seconds)) return '—';
    if (seconds < 1) return '<1s';
    const s = Math.floor(seconds % 60);
    const m = Math.floor((seconds / 60) % 60);
    const h = Math.floor(seconds / 3600);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Resources Panel */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Zasoby</div>
          <Tooltip
            content={
              <div>
                Produkcja zmienia się w czasie:
                <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                  <li>W nocy słońce spada do 0.</li>
                  <li>Pogoda (wiatr, deszcz/śnieg) modyfikuje tempo.</li>
                  <li>ViCoins rosną stale; niektóre instalacje dodają bonusy.</li>
                </ul>
              </div>
            }
          >
            <span style={{ fontSize: 12, color: '#374151', cursor: 'help' }}>ℹ️</span>
          </Tooltip>
        </div>
        <div style={{ fontSize: 12, color: "#666", lineHeight: 1.4 }}>
          {rateText("sun")} ☀️ / {rateText("wind")} 🌬️ / {rateText("water")} 💧 / {rateText("coins")} 💰
        </div>
      </div>

      {/* Heating Systems */}
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Systemy grzewcze</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {deviceItems.map((item) => (
            <button
              key={item.key}
              style={{
                ...btn(pendingPlacement?.key === item.key),
                opacity: canAfford(item) ? 1 : 0.5,
                justifyContent: "flex-start",
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
              }}
              onClick={() => canAfford(item) && onPurchase(item)}
              disabled={!canAfford(item)}
            >
              <span>{item.icon}</span>
              <div style={{ textAlign: "left", flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{item.name}</div>
                  <div style={{ fontSize: 10, opacity: 0.8 }}>
                    {item.price} 💰
                    {!canAfford(item) && (
                      <span style={{ marginLeft: 8, color: '#374151' }}>
                        ⏳ {fmtTime(timeToAfford(item))}
                      </span>
                    )}
                  </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Production & Upgrades */}
      {renewablesUnlocked && (
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Ulepszenia</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {productionItems.map((item) => (
              <button
                key={item.key}
                style={{
                  ...btn(pendingPlacement?.key === item.key),
                  opacity: canAfford(item) ? 1 : 0.5,
                  justifyContent: "flex-start",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                }}
                onClick={() => canAfford(item) && onPurchase(item)}
                disabled={!canAfford(item)}
              >
                <span>{item.icon}</span>
                <div style={{ textAlign: "left", flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{item.name}</div>
                  <div style={{ fontSize: 10, opacity: 0.8 }}>
                    {item.price} 💰
                    {!canAfford(item) && (
                      <span style={{ marginLeft: 8, color: '#374151' }}>
                        ⏳ {fmtTime(timeToAfford(item))}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Cancel Button */}
      {pendingPlacement && (
        <button
          style={{
            ...btn(false),
            background: "#dc2626",
            color: "#fff",
            width: "100%",
          }}
          onClick={onItemCancel}
        >
          Anuluj
        </button>
      )}
    </div>
  );
}
