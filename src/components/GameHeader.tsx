import type { ResourceState } from '../types';

interface GameHeaderProps {
  resources: ResourceState;
  pollution: number;
  isDay: boolean;
  phasePct: number;
}

export function GameHeader({ resources, pollution, isDay, phasePct }: GameHeaderProps) {
  const fmt = (n: number) => (n % 1 === 0 ? n.toString() : n.toFixed(1));

  const pill: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    background: "rgba(255,255,255,0.7)",
    padding: "6px 12px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  };

  const headerStyle: React.CSSProperties = {
    position: "sticky",
    top: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    borderBottom: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.6)",
    padding: "10px 16px",
    zIndex: 10,
  };

  return (
    <header style={headerStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, background: "#EA580C" }} />
        <span style={{ fontSize: 14 }}>Viessmann</span>
      </div>
      
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={pill}>
          <span style={{ fontSize: 18 }}>☀️</span>
          <div>
            <div style={{ fontSize: 11, color: "#555" }}>Słońce</div>
            <div style={{ fontWeight: 600, color: "#111" }}>{fmt(resources.sun)}</div>
          </div>
        </div>
        <div style={pill}>
          <span style={{ fontSize: 18 }}>💧</span>
          <div>
            <div style={{ fontSize: 11, color: "#555" }}>Woda</div>
            <div style={{ fontWeight: 600, color: "#111" }}>{fmt(resources.water)}</div>
          </div>
        </div>
        <div style={pill}>
          <span style={{ fontSize: 18 }}>🌬️</span>
          <div>
            <div style={{ fontSize: 11, color: "#555" }}>Wiatr</div>
            <div style={{ fontWeight: 600, color: "#111" }}>{fmt(resources.wind)}</div>
          </div>
        </div>
        <div style={pill}>
          <span style={{ fontSize: 18 }}>💰</span>
          <div>
            <div style={{ fontSize: 11, color: "#555" }}>ViCoins</div>
            <div style={{ fontWeight: 600, color: "#111" }}>{fmt(resources.coins)}</div>
          </div>
        </div>
        <div style={pill}>
          <span style={{ fontSize: 18 }}>🏭</span>
          <div>
            <div style={{ fontSize: 11, color: "#555" }}>Zanieczyszczenie</div>
            <div style={{ fontWeight: 600, color: "#111" }}>{Math.round(pollution)}</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
        <span>{isDay ? "☀️ Dzień" : "🌙 Noc"}</span>
        <div style={{ width: 120, height: 4, borderRadius: 4, background: "#e5e7eb", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${phasePct}%`, background: "#111" }} />
        </div>
      </div>
    </header>
  );
}
