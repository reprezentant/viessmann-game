import type { GameItem, ResourceState, ResKey } from '../types';

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
  const fmt = (n: number) => (n % 1 === 0 ? n.toString() : n.toFixed(1));
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Resources Panel */}
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Zasoby</div>
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
                <div style={{ fontSize: 10, opacity: 0.8 }}>{item.price} 💰</div>
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
                  <div style={{ fontSize: 10, opacity: 0.8 }}>{item.price} 💰</div>
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
