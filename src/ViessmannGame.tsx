import React, { useEffect, useMemo, useRef, useState } from "react";
// --- Typy bazowe ---
type ResKey = "sun" | "water" | "wind" | "coins";
type EntityType =
  | "coal"
  | "pellet"
  | "gas"
  | "floor"
  | "thermostat"
  | "heatpump"
  | "inverter"
  | "grid"
  | "forest"
  | "solar"
  | "echarger";
// --- Typy pomocnicze (przeniesione z poprzednich wersji) ---
type Tile = { id: string; x: number; y: number; entity?: EntityInstance | null; isHome?: boolean };
type EntityInstance = { type: EntityType; label: string; icon: string };
type Cost = Partial<Record<ResKey, number>>;
type ShopItem = {
  key: EntityType;
  name: string;
  description: string;
  icon: string;
  cost: Cost;
  requires?: (EntityType | "coal")[];
  onPurchaseEffects?: (ctx: EffectsContext) => void;
};
type EffectsContext = {
  addRate: (key: ResKey, deltaPerSec: number) => void;
  multiplyAll: (mult: number) => void;
  discountNextPurchasesPct: (pct: number) => void;
};

// --- Typy wydarzeń pogodowych ---
type WeatherEventType = "none" | "clouds" | "sunny" | "rain" | "frost" | "wind";
type WeatherEvent = {
  type: WeatherEventType;
  duration: number; // sekundy
  remaining: number; // sekundy
};

export default function ViessmannGame() {
  // --- Wszystkie stany i stałe na początek ---
  // Pogoda
  const [weatherEvent, setWeatherEvent] = useState<WeatherEvent>({ type: "none", duration: 0, remaining: 0 });
  const WEATHER_EVENT_INTERVAL = 30; // co ile sekund losować nowe wydarzenie
  const WEATHER_EVENT_DURATION = 25; // ile trwa wydarzenie
  const FROST_EVENT_DURATION = 30; // ile trwa mróz
  // Zasoby
  const [resources, setResources] = useState<Record<ResKey, number>>({ sun: 0, water: 0, wind: 0, coins: 0 });
  const [baseRates, setBaseRates] = useState<Record<ResKey, number>>({ sun: 0, wind: 0, water: 0, coins: 0.05 });
  const TICK_MS = 1000;
  // Zanieczyszczenie
  const [pollution, setPollution] = useState(0);
  const [pollutionRate, setPollutionRate] = useState(0);
  const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));
  const addPollutionRate = (d: number) => setPollutionRate((p) => p + d);
  // Dzień/noc
  const DAY_LENGTH = 240; // s
  const DAY_FRACTION = 0.7; // 70% dzień
  const [elapsed, setElapsed] = useState(0);
  const isDay = useMemo(() => (elapsed % DAY_LENGTH) < DAY_LENGTH * DAY_FRACTION, [elapsed]);

  // --- Pogodowe wydarzenia losowe ---
  useEffect(() => {
    if (weatherEvent.type !== "none" && weatherEvent.remaining > 0) {
      const timer = setTimeout(() => {
        setWeatherEvent(ev => ({ ...ev, remaining: ev.remaining - 1 }));
      }, 1000);
      return () => clearTimeout(timer);
    }
    if (weatherEvent.type !== "none" && weatherEvent.remaining <= 0) {
      setWeatherEvent({ type: "none", duration: 0, remaining: 0 });
    }
  }, [weatherEvent]);

  useEffect(() => {
    if (weatherEvent.type !== "none") return;
    const interval = setInterval(() => {
      const roll = Math.random();
      let type: WeatherEventType = "none";
      // W nocy nie może być eventu Słońce
      if (isDay) {
        if (roll < 0.18) type = "clouds";
        else if (roll < 0.36) type = "sunny";
        else if (roll < 0.54) type = "rain";
        else if (roll < 0.68) type = "wind";
        else if (roll < 0.78) type = "frost";
      } else {
        if (roll < 0.225) type = "clouds";
        else if (roll < 0.45) type = "rain";
        else if (roll < 0.65) type = "wind";
        else if (roll < 0.8) type = "frost";
      }
      if (type === "frost") {
        setWeatherEvent({ type, duration: FROST_EVENT_DURATION, remaining: FROST_EVENT_DURATION });
      } else if (type !== "none") {
        setWeatherEvent({ type, duration: WEATHER_EVENT_DURATION, remaining: WEATHER_EVENT_DURATION });
      }
    }, WEATHER_EVENT_INTERVAL * 1000);
    return () => clearInterval(interval);
  }, [weatherEvent.type, isDay]);

  const weatherMultipliers: Record<ResKey, number> = useMemo(() => {
  if (weatherEvent.type === "clouds") return { sun: 0, water: 1, wind: 1, coins: 1 };
  if (weatherEvent.type === "sunny") return { sun: 2, water: 1, wind: 1, coins: 1 };
  if (weatherEvent.type === "rain") return { sun: 1, water: 2, wind: 1, coins: 1 };
  if (weatherEvent.type === "wind") return { sun: 0.5, water: 0.7, wind: 2, coins: 1 };
  if (weatherEvent.type === "frost") return { sun: 0, water: 0, wind: 0, coins: 0 };
  return { sun: 1, water: 1, wind: 1, coins: 1 };
  }, [weatherEvent.type]);
  const phasePct = useMemo(() => {
    const mod = elapsed % DAY_LENGTH;
    const dayLen = DAY_LENGTH * DAY_FRACTION;
    const nightLen = DAY_LENGTH - dayLen;
    if (mod < dayLen) return (mod / dayLen) * 100;
    return ((mod - dayLen) / nightLen) * 100;
  }, [elapsed]);

  // --- Mnożniki: dzień/noc * wydarzenie pogodowe ---
  const multipliers: Record<ResKey, number> = useMemo(() => {
    const dayNight = isDay ? { sun: 2.0, wind: 1.0, water: 1.0, coins: 1.0 } : { sun: 0.0, wind: 1.2, water: 1.0, coins: 1.0 };
    // Połącz z pogodą
    return {
      sun: dayNight.sun * weatherMultipliers.sun,
      wind: dayNight.wind * weatherMultipliers.wind,
      water: dayNight.water * weatherMultipliers.water,
      coins: dayNight.coins * weatherMultipliers.coins,
    };
  }, [isDay, weatherMultipliers]);
  const [renewablesUnlocked, setRenewablesUnlocked] = useState(false);
  const effectiveRates = useMemo(
    () => ({
      sun: renewablesUnlocked ? +(baseRates.sun * multipliers.sun) : 0,
      wind: renewablesUnlocked ? +(baseRates.wind * multipliers.wind) : 0,
      water: renewablesUnlocked ? +(baseRates.water * multipliers.water) : 0,
      coins: +(baseRates.coins * multipliers.coins),
    }),
    [baseRates, multipliers, renewablesUnlocked]
  );

  // ---------- Map ----------
  const SIZE = 7;
  const CENTER = Math.floor(SIZE / 2);
  const [tiles, setTiles] = useState<Tile[]>(() => {
    const list: Tile[] = [];
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      list.push({ id: `${x},${y}`, x, y, entity: null, isHome: x === CENTER && y === CENTER });
    }
    return list;
  });
  const homeTileId = `${CENTER},${CENTER}`;

  // ---------- Shop ----------
  const [priceDiscountPct, setPriceDiscountPct] = useState(0);
  const [owned, setOwned] = useState<Record<EntityType | "coal", number>>({
    coal: 0, pellet: 0, gas: 0, floor: 0, thermostat: 0, heatpump: 0, inverter: 0, grid: 0, solar: 0, echarger: 0, forest: 0,
  });

// --- Shop items przeniesione poza komponent, by nie powodowały ostrzeżeń Reacta ---
const deviceItems: ShopItem[] = [
  { key: "coal", name: "Kocioł węglowy", description: "Legacy heating. Zwiększa zanieczyszczenie (🏭). Postaw na domu.", icon: "🪨", cost: { coins: 0 } },
  { key: "pellet", name: "Kocioł na pellet (Vitoligno)", description: "Czystszy niż węgiel. Zastępuje kocioł węglowy.", icon: "🔥🌲", cost: { coins: 10 }, requires: ["coal"] },
  { key: "gas", name: "Kocioł gazowy (Vitodens)", description: "Kup za ☀️ + 💧 + 🌬️. Zastępuje kocioł na pellet.", icon: "🔥", cost: { sun: 30, water: 20, wind: 20 }, requires: ["pellet"] },
  { key: "floor", name: "Ogrzewanie podłogowe", description: "Komfort + niższa temp. zasilania.", icon: "🧱", cost: { sun: 10, water: 10, wind: 5 }, requires: ["gas"],
    onPurchaseEffects: ({ addRate }) => addRate("coins", 0.1) },
  { key: "thermostat", name: "Termostaty SRC", description: "Lepsza kontrola.", icon: "🌡️", cost: { sun: 5, water: 5, wind: 5 }, requires: ["gas"],
    onPurchaseEffects: ({ addRate }) => addRate("coins", 0.1) },
  { key: "heatpump", name: "Pompa ciepła (Vitocal)", description: "Odblokowuje OZE.", icon: "🌀", cost: { sun: 50, water: 40, wind: 40 }, requires: ["gas", "floor", "thermostat"] },
  { key: "inverter", name: "Inverter / magazyn (Vitocharge)", description: "Lepsza monetyzacja.", icon: "🔶", cost: { sun: 20, water: 10, wind: 10 }, requires: ["heatpump"] },
  { key: "grid", name: "Grid", description: "Przyłącze sieciowe.", icon: "⚡", cost: { sun: 10, water: 10, wind: 20 }, requires: ["inverter"] },
];

const productionItems: ShopItem[] = [
  { key: "forest", name: "Las", description: "Silnie redukuje zanieczyszczenie (−0.5/s). Koszt: 10 ☀️ + 10 💧.", icon: "🌲", cost: { sun: 10, water: 10 } },
  { key: "solar", name: "Fotowoltaika (Vitovolt)", description: "Więcej ☀️.", icon: "🔆", cost: { sun: 20, wind: 10 }, requires: ["heatpump"] },
  { key: "echarger", name: "E-Charger", description: "+5 💰/min.", icon: "🔌", cost: { wind: 20, water: 20 }, requires: ["heatpump"] },
];

  const [shopTab, setShopTab] = useState<"devices" | "production">("devices");
  const isSinglePurchase = (k: EntityType) => !["solar", "echarger", "forest"].includes(k);

  const [hasECharger, setHasECharger] = useState(false);
  const echargerBonusRef = useRef(0);
  const [pendingPlacement, setPendingPlacement] = useState<ShopItem | null>(null);
  const [lastPlacedKey, setLastPlacedKey] = useState<string | null>(null);

  // Helpers
  const canAfford = (c: Cost) => Object.entries(c).every(([k, v]) => (resources as Record<string, number>)[k] >= (v ?? 0));
  const discountedCost = (cost: Cost): Cost => {
    if (!priceDiscountPct) return cost; const out: Cost = {};
    for (const [k, v] of Object.entries(cost)) if (typeof v === "number") out[k as ResKey] = Math.ceil(v * (1 - priceDiscountPct / 100));
    return out;
  };
  const payCost = (cost: Cost) => setResources(r => {
    const n = { ...r } as Record<ResKey, number>;
    for (const [k, v] of Object.entries(cost)) n[k as ResKey] -= v ?? 0;
    return n;
  });
  const modifyBaseRates = (fn: (r: Record<ResKey, number>) => Record<ResKey, number>) => setBaseRates(r => fn({ ...r }));
  const effectsCtx: EffectsContext = {
    addRate: (k, d) => modifyBaseRates(r => ({ ...r, [k]: (r[k] ?? 0) + d })),
    multiplyAll: (m) => modifyBaseRates(r => { const n = { ...r } as Record<ResKey, number>; (Object.keys(n) as ResKey[]).forEach(k => n[k] *= m); return n; }),
    discountNextPurchasesPct: (pct) => setPriceDiscountPct(p => Math.min(90, p + pct)),
  };

  // Loop
  useEffect(() => {
    const id = setInterval(() => {
      setResources(r => ({
        sun: r.sun + effectiveRates.sun,
        wind: r.wind + effectiveRates.wind,
        water: r.water + effectiveRates.water,
        coins: r.coins + effectiveRates.coins,
      }));
      setElapsed(e => e + 1);
      if (hasECharger) {
        echargerBonusRef.current += 1;
        if (echargerBonusRef.current >= 60) { echargerBonusRef.current = 0; setResources(r => ({ ...r, coins: r.coins + 5 })); }
      }
      setPollution(p => clamp(p + pollutionRate));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [effectiveRates, hasECharger, pollutionRate]);

  // Widoki list
  const visibleDevices = useMemo(() => {
    return deviceItems.filter(it => {
      // Hide coal if pellet or gas is owned
      if (it.key === "coal" && (owned.pellet > 0 || owned.gas > 0)) return false;
      // Hide pellet if gas is owned
      if (it.key === "pellet" && owned.gas > 0) return false;
      if (!it.requires) return true;
      return it.requires.every(k => owned[k] > 0);
    });
  }, [owned]);

  const visibleProduction = useMemo(() => productionItems.filter(it => !it.requires || it.requires.every(k => owned[k] > 0)), [owned]);

  // Zakup
  const handleBuy = (item: ShopItem) => {
    if (isSinglePurchase(item.key) && (owned[item.key] ?? 0) > 0) return;
    const cost = discountedCost(item.cost);
    if (!canAfford(cost)) return;
    payCost(cost);
    if (item.key === "coal" || item.key === "pellet" || item.key === "gas") { setPendingPlacement(item); return; }
    setOwned(o => ({ ...o, [item.key]: (o[item.key] ?? 0) + 1 }));
    if (item.key === "echarger") setHasECharger(true);
    item.onPurchaseEffects?.(effectsCtx);
    setPendingPlacement(item);
  };

  // Placement
  const placeOnTile = (tile: Tile) => {
    if (!pendingPlacement) return;

    if (pendingPlacement.key === "coal") {
  if (tile.id !== homeTileId || tile.entity) return;
  const instance: EntityInstance = { type: "coal", label: pendingPlacement.name, icon: pendingPlacement.icon };
  setTiles(ts => ts.map(t => t.id === tile.id ? { ...t, entity: instance } : t));
  addPollutionRate(+0.4); // even stronger pollution for coal
      setOwned(o => ({ ...o, coal: (o.coal ?? 0) + 1 }));
      setPendingPlacement(null); setLastPlacedKey(tile.id); return;
    }
    if (pendingPlacement.key === "pellet") {
  if (tile.id !== homeTileId) return;
  const instance: EntityInstance = { type: "pellet", label: pendingPlacement.name, icon: pendingPlacement.icon };
  setTiles(ts => ts.map(t => t.id === tile.id ? { ...t, entity: instance } : t));
  setOwned(o => ({ ...o, coal: 0, pellet: (o.pellet ?? 0) + 1 }));
  addPollutionRate(-0.25); // even stronger cleaning for pellet
      setRenewablesUnlocked(true);
      setBaseRates(r => ({ ...r, sun: Math.max(r.sun, 1 / 12), wind: Math.max(r.wind, 1 / 16), water: Math.max(r.water, 1 / 18), coins: 0.03 }));
      setPendingPlacement(null); setLastPlacedKey(tile.id); return;
    }
    if (pendingPlacement.key === "gas") {
      if (tile.id !== homeTileId) return;
      const instance: EntityInstance = { type: "gas", label: pendingPlacement.name, icon: pendingPlacement.icon };
      setTiles(ts => ts.map(t => t.id === tile.id ? { ...t, entity: instance } : t));
      setOwned(o => ({ ...o, pellet: 0, gas: (o.gas ?? 0) + 1 }));
      addPollutionRate(-0.1);
      setBaseRates(r => ({ ...r, coins: Math.min(r.coins, 0.03) }));
      setPendingPlacement(null); setLastPlacedKey(tile.id); return;
    }

    if (!tile.isHome && tile.entity) return;
    if (tile.isHome && tiles.find(t => t.id === homeTileId)?.entity) return;

    const instance: EntityInstance = { type: pendingPlacement.key, label: pendingPlacement.name, icon: pendingPlacement.icon };
    setTiles(ts => ts.map(t => t.id === tile.id ? { ...t, entity: instance } : t));
    setPendingPlacement(null); setLastPlacedKey(tile.id);
  };

  useEffect(() => {
    if (!lastPlacedKey) return;
    const t = setTimeout(() => setLastPlacedKey(null), 400);
    return () => clearTimeout(t);
  }, [lastPlacedKey]);

  // --- UI helpers ---
  const fmt = (n: number) => (n % 1 === 0 ? n.toString() : n.toFixed(1));
  const rateText = (k: ResKey) => `+${fmt(effectiveRates[k])}/s`;

  // --- styles ---
  const pill: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, borderRadius: 999, background: "rgba(255,255,255,0.7)", padding: "6px 12px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" };
  const headerStyle: React.CSSProperties = {
    position: "sticky",
    top: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    borderBottom: isDay ? "1px solid rgba(0,0,0,0.08)" : "1px solid #334155",
    background: isDay ? "rgba(255,255,255,0.6)" : "rgba(30,41,59,0.98)",
    padding: "10px 16px",
    zIndex: 10
  };
  const gridWrap: React.CSSProperties = { display: "grid", gridTemplateColumns: "300px 1fr 340px", gap: 16, padding: 16, width: "100vw", boxSizing: "border-box" };

  // --- Missions ---
  type Mission = {
    key: string;
    title: string;
    description: string;
    completed: boolean;
    reward: string;
    accent?: "emerald" | "red";
  };
  const [missions, setMissions] = useState<Mission[]>([
    {
      key: "first-steps",
      title: "Pierwsze kroki",
      description: "Postaw kocioł węglowy na domu.",
      completed: false,
      reward: "+10 ViCoins",
      accent: "emerald",
    },
    {
      key: "eco-choice",
      title: "Ekologiczny wybór",
      description: "Zamień kocioł węglowy na pelletowy.",
      completed: false,
      reward: "-20 zanieczyszczenia",
      accent: "emerald",
    },
    {
      key: "green-investment",
      title: "Zielona inwestycja",
      description: "Posadź las.",
      completed: false,
      reward: "-30 zanieczyszczenia",
      accent: "emerald",
    },
  ]);

  // Mission completion logic
  useEffect(() => {
    setMissions(prev => prev.map(m => {
      if (m.key === "first-steps" && !m.completed && owned.coal > 0) {
        // Reward: +10 ViCoins
        setResources(r => ({ ...r, coins: r.coins + 10 }));
        return { ...m, completed: true };
      }
      if (m.key === "eco-choice" && !m.completed && owned.pellet > 0) {
        // Reward: -20 pollution
        setPollution(p => Math.max(0, p - 20));
        return { ...m, completed: true };
      }
      if (m.key === "green-investment" && !m.completed && owned.forest > 0) {
        // Reward: -30 pollution
        setPollution(p => Math.max(0, p - 30));
        return { ...m, completed: true };
      }
      return m;
    }));
  }, [owned]);
  const card: React.CSSProperties = {
    borderRadius: 16,
    background: isDay ? "rgba(255,255,255,0.7)" : "rgba(30,41,59,0.92)",
    padding: 12,
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
    color: isDay ? undefined : "#F1F5F9"
  };
  const btn = (active: boolean): React.CSSProperties => ({ padding: "6px 12px", borderRadius: 999, fontSize: 13, border: "none", cursor: "pointer", background: active ? "#0a0a0a" : "#e5e5e5", color: active ? "#fff" : "#111" });

  // Render
  return (
  <div className="font-sans" style={{ minHeight: "100vh", width: "100vw", maxWidth: "100vw", boxSizing: "border-box", overflowX: "hidden", background: isDay ? "linear-gradient(135deg,#FFF7ED,#FEF3C7,#FFE4E6)" : "linear-gradient(135deg,#0f172a,#111827,#312e81)", color: isDay ? "#111" : "#E5E7EB" }}>
      {/* top bar */}
      <header style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: "#EA580C" }} />
          <span className="font-extrabold text-base font-sans">Viessmann</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            ...pill,
            background: isDay ? "rgba(255,255,255,0.7)" : "#0f172a",
            padding: "6px 24px"
          }}>
            <span style={{ fontSize: 18 }}>☀️</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 12, fontFamily: 'Manrope, system-ui, sans-serif', color: isDay ? "#334155" : "#F1F5F9" }}>Słońce</div>
              <div className="font-semibold font-sans tabular-nums" style={{ color: isDay ? "#111" : "#FBBF24" }}>{fmt(resources.sun)}</div>
            </div>
          </div>
          <div style={{
            ...pill,
            background: isDay ? "rgba(255,255,255,0.7)" : "#0f172a",
            padding: "6px 24px"
          }}>
            <span style={{ fontSize: 18 }}>💧</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 12, fontFamily: 'Manrope, system-ui, sans-serif', color: isDay ? "#334155" : "#F1F5F9" }}>Woda</div>
              <div className="font-semibold font-sans tabular-nums" style={{ color: isDay ? "#111" : "#38BDF8" }}>{fmt(resources.water)}</div>
            </div>
          </div>
          <div style={{
            ...pill,
            background: isDay ? "rgba(255,255,255,0.7)" : "#0f172a",
            padding: "6px 24px"
          }}>
            <span style={{ fontSize: 18 }}>🌬️</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 12, fontFamily: 'Manrope, system-ui, sans-serif', color: isDay ? "#334155" : "#F1F5F9" }}>Wiatr</div>
              <div className="font-semibold font-sans tabular-nums" style={{ color: isDay ? "#111" : "#A5B4FC" }}>{fmt(resources.wind)}</div>
            </div>
          </div>
          <div style={{
            ...pill,
            background: isDay ? "rgba(255,255,255,0.7)" : "#0f172a",
            padding: "6px 24px"
          }}>
            <span style={{ fontSize: 18 }}>💰</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 12, fontFamily: 'Manrope, system-ui, sans-serif', color: isDay ? "#334155" : "#F1F5F9" }}>ViCoins</div>
              <div className="font-semibold font-sans tabular-nums" style={{ color: isDay ? "#111" : "#FDE68A" }}>{fmt(resources.coins)}</div>
            </div>
          </div>
          {/* Weather Event Pill - zawsze widoczny */}
          <div style={{
            ...pill,
            background: isDay ? "rgba(255,255,255,0.7)" : "#0f172a",
            padding: "6px 24px",
            minWidth: 120,
            display: "flex",
            alignItems: "center",
            gap: 10,
            position: 'relative'
          }}>
            <span style={{ fontSize: 20 }}>
              {weatherEvent.type === "clouds" && "☁️"}
              {weatherEvent.type === "sunny" && "🌞"}
              {weatherEvent.type === "rain" && "🌧️"}
              {weatherEvent.type === "wind" && "🌬️"}
              {weatherEvent.type === "frost" && "❄️"}
              {weatherEvent.type === "none" && "🌤️"}
            </span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 12, color: isDay ? "#0ea5e9" : "#bae6fd" }}>
                {weatherEvent.type === "clouds" && "Chmury"}
                {weatherEvent.type === "sunny" && "Słońce"}
                {weatherEvent.type === "rain" && "Deszcz"}
                {weatherEvent.type === "wind" && "Wiatr"}
                {weatherEvent.type === "frost" && "Mróz"}
                {weatherEvent.type === "none" && "Brak wydarzenia"}
              </div>
              <div style={{ fontSize: 13, color: isDay ? "#334155" : "#e0f2fe" }}>
                {weatherEvent.type === "clouds" && "Brak produkcji ☀️"}
                {weatherEvent.type === "sunny" && "x2 produkcja ☀️"}
                {weatherEvent.type === "rain" && "x2 produkcja 💧"}
                {weatherEvent.type === "wind" && "x2 produkcja 🌬️, -50% ☀️, -30% 💧"}
                {weatherEvent.type === "frost" && "Wszystkie produkcje zatrzymane"}
                {weatherEvent.type === "none" && "Brak efektu specjalnego"}
              </div>
            </div>
            {weatherEvent.type !== "none" && (
              <span style={{ fontSize: 13, fontWeight: 600, marginLeft: 8, color: isDay ? "#0ea5e9" : "#bae6fd" }}>{weatherEvent.remaining}s</span>
            )}
            {/* Infotip z legendą wydarzeń pogodowych - przejrzysty układ, inna ikona */}
            <span style={{ marginLeft: 10, cursor: 'pointer', position: 'relative', display: 'inline-block' }} tabIndex={0}>
              <span style={{ fontSize: 17, color: isDay ? '#0ea5e9' : '#bae6fd', fontWeight: 700, verticalAlign: 'middle' }}>ℹ️</span>
              <div style={{
                display: 'none',
                position: 'absolute',
                left: '50%',
                top: '120%',
                transform: 'translateX(-50%)',
                minWidth: 220,
                background: isDay ? '#fff' : '#1e293b',
                color: isDay ? '#0f172a' : '#e0f2fe',
                border: '1px solid #bae6fd',
                borderRadius: 10,
                boxShadow: '0 4px 16px rgba(30,64,175,0.10)',
                padding: '14px 18px',
                fontSize: 13,
                zIndex: 100,
                pointerEvents: 'none',
              }} className="weather-legend-tip">
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Legenda wydarzeń pogodowych:</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span>☁️</span><span style={{ fontWeight: 700 }}>Chmury</span></span>
                  <span style={{ color: '#64748b', fontSize: 12, marginLeft: 28 }}>brak produkcji ☀️</span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span>🌞</span><span style={{ fontWeight: 700 }}>Słońce</span></span>
                  <span style={{ color: '#fbbf24', fontSize: 12, marginLeft: 28 }}>x2 produkcja ☀️</span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span>🌧️</span><span style={{ fontWeight: 700 }}>Deszcz</span></span>
                  <span style={{ color: '#38bdf8', fontSize: 12, marginLeft: 28 }}>x2 produkcja 💧</span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span>🌬️</span><span style={{ fontWeight: 700 }}>Wiatr</span></span>
                  <span style={{ color: '#38bdf8', fontSize: 12, marginLeft: 28 }}>x2 produkcja 🌬️, -50% ☀️, -30% 💧</span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span>❄️</span><span style={{ fontWeight: 700 }}>Mróz</span></span>
                  <span style={{ color: '#60a5fa', fontSize: 12, marginLeft: 28 }}>wszystkie produkcje zatrzymane na 30s</span>
                </div>
              </div>
              <style>{`
                .weather-legend-tip, .weather-legend-tip:focus, .weather-legend-tip:active { pointer-events: none; }
                span[tabindex]:hover .weather-legend-tip, span[tabindex]:focus .weather-legend-tip {
                  display: block !important;
                  pointer-events: auto;
                }
              `}</style>
            </span>
          </div>
          <div style={{
            ...pill,
            background: isDay ? "rgba(255,255,255,0.7)" : "#0f172a",
            padding: "6px 24px"
          }}>
            <span style={{ fontSize: 18 }}>🏭</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 12, fontFamily: 'Manrope, system-ui, sans-serif', color: isDay ? "#334155" : "#F1F5F9" }}>Zanieczyszczenie</div>
              <div className="font-semibold font-sans tabular-nums" style={{ color: isDay ? "#111" : "#FCA5A5" }}>{Math.round(pollution)}</div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }} className="text-base font-medium font-sans">
          <span className="font-medium font-sans">{isDay ? "☀️ Dzień" : "🌙 Noc"}</span>
          <div style={{ width: 120, height: 4, borderRadius: 4, background: "#e5e7eb", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${phasePct}%`, background: "#111" }} />
          </div>
        </div>
      </header>

      {/* body */}
      <main style={gridWrap}>
        {/* shop */}
        <aside style={card}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <button className={`font-semibold font-sans ${shopTab === "devices" ? "bg-neutral-900 text-white" : "bg-neutral-200 text-neutral-900"} rounded-full text-sm px-3 py-1`} style={btn(shopTab === "devices")} onClick={() => setShopTab("devices")}>Urządzenia</button>
            <button className={`font-semibold font-sans ${shopTab === "production" ? "bg-neutral-900 text-white" : "bg-neutral-200 text-neutral-900"} rounded-full text-sm px-3 py-1`} style={btn(shopTab === "production")} onClick={() => setShopTab("production")}>Produkcja</button>
          </div>
          {/* Removed start tooltip text as requested */}
          <div style={{ display: "grid", gap: 8 }}>
            {(shopTab === "devices" ? visibleDevices : visibleProduction).map((item) => {
              const cost = discountedCost(item.cost);
              const ownedCount = owned[item.key] ?? 0;
              const done = isSinglePurchase(item.key) && ownedCount > 0;
              const afford = !done && canAfford(cost);
              const isPending = pendingPlacement?.key === item.key;
              return (
                <div
                  key={item.key}
                  style={{
                    ...card,
                    padding: 12,
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 120,
                    background: isDay ? (card.background ?? "rgba(255,255,255,0.7)") : "#0f172a"
                  }}
                >
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 22 }}>{item.icon}</span>
                    <div style={{ flex: 1 }}>
                      <span className="font-bold font-sans text-base" style={{ fontWeight: 700 }}>{item.name}</span>
                      <div className="text-xs text-neutral-500 font-sans" style={{ fontSize: 11, marginTop: 2, marginBottom: 2 }}>Posiadane: {ownedCount}</div>
                      <div className="font-normal text-xs text-neutral-600 font-sans" style={{ fontSize: 13 }}>{item.description}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 8, marginBottom: 36 }}>
                    {!done ? (
                      <span className="text-sm font-semibold font-sans tabular-nums">
                        Koszt:&nbsp;
                        {cost.sun ? `${cost.sun} ☀️ ` : ""}{cost.water ? `+ ${cost.water} 💧 ` : ""}{cost.wind ? `+ ${cost.wind} 🌬️ ` : ""}{cost.coins ? `+ ${cost.coins} 💰` : ""}
                        {!cost.sun && !cost.water && !cost.wind && !cost.coins ? "—" : ""}
                      </span>
                    ) : (
                      <span className="text-xs font-semibold font-sans text-emerald-600" style={{fontSize:12}}>Zrobione ✓</span>
                    )}
                  </div>
                  {!done && (
                    <button
                      onClick={() => afford && handleBuy(item)}
                      disabled={!afford}
                      className={`font-semibold font-sans text-sm rounded ${afford ? "bg-neutral-900 text-white" : "bg-neutral-200 text-neutral-400"}`}
                      style={{
                        ...btn(true),
                        width: "100%",
                        marginTop: "auto",
                        opacity: afford ? 1 : 0.5,
                        transform: isPending ? "scale(0.96)" : "scale(1)",
                        transition: "transform 150ms ease",
                        minHeight: 36,
                      }}
                    >
                      {afford ? (isPending ? "Kliknij kafelek…" : "Kup") : "Brak zasobów"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

  {/* map */}
  <section style={{ ...card, position: 'relative' }}>
          {/* Animacje pogodowe przeniesione do IsoGrid */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <h2 className="font-bold font-sans text-lg text-neutral-900">Dom i otoczenie</h2>
            <div className="font-medium text-xs text-neutral-600 font-sans">
              {rateText("sun")} ☀️ / {rateText("wind")} 🌬️ / {rateText("water")} 💧 / {rateText("coins")} 💰
            </div>
          </div>
          <IsoGrid
            tiles={tiles}
            homeTileId={homeTileId}
            onTileClick={placeOnTile}
            pendingItem={pendingPlacement ? { name: pendingPlacement.name, icon: pendingPlacement.icon } : null}
            lastPlacedKey={lastPlacedKey}
            isPlaceable={(t) => {
              if (!pendingPlacement) return false;
              if (pendingPlacement.key === "coal" || pendingPlacement.key === "pellet" || pendingPlacement.key === "gas") {
                if (t.id !== homeTileId) return false;
                if (pendingPlacement.key === "coal") return !t.entity;
                return true;
              }
              if (t.isHome) {
                const home = tiles.find((x) => x.id === homeTileId);
                return !!home && !home.entity;
              }
              return !t.entity;
            }}
            weatherEvent={weatherEvent}
            isDay={isDay}
          />
        </section>

        {/* missions */}
        <aside style={{
          ...card,
          minHeight: 400,
          maxHeight: '80vh',
          background: isDay ? "rgba(255,255,255,0.85)" : "rgba(30,41,59,0.98)",
          color: isDay ? undefined : "#F1F5F9",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          overflowY: 'auto',
          marginRight: 8
        }}>
          <h2 className="font-bold font-sans text-lg text-neutral-900 mb-2">Misje</h2>
          {/* Mission progress bar */}
          {missions.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span className="text-xs font-sans text-neutral-500">Postęp misji</span>
                <span className="text-xs font-sans text-neutral-500">{missions.filter(m => m.completed).length} / {missions.length}</span>
              </div>
              <div style={{ width: "100%", height: 8, background: isDay ? "#E5E7EB" : "#334155", borderRadius: 6, overflow: "hidden" }}>
                <div style={{
                  width: `${Math.round(100 * missions.filter(m => m.completed).length / missions.length)}%`,
                  height: "100%",
                  background: "linear-gradient(90deg,#10B981,#22D3EE)",
                  transition: "width 0.4s cubic-bezier(.4,2,.6,1)",
                }} />
              </div>
            </div>
          )}
          {/* Sekcja aktywne misje */}
          <div style={{ marginBottom: 18 }}>
            <div className="font-semibold text-sm mb-2" style={{ color: isDay ? "#0ea5e9" : "#bae6fd" }}>Aktywne misje</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {missions.filter(m => !m.completed).length === 0 && (
                <div style={{ color: isDay ? "#64748b" : "#94a3b8", fontSize: 14, padding: 8 }}>Brak aktywnych misji 🎉</div>
              )}
              {missions.filter(m => !m.completed).map(m => (
                <div key={m.key} style={{
                  borderRadius: 12,
                  background: isDay ? "#fff" : "#1e293b",
                  color: isDay ? undefined : "#F1F5F9",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                  padding: 12,
                  border: isDay ? "1.5px solid #E5E7EB" : "1.5px solid #334155",
                  opacity: 1,
                  transition: "all 0.2s"
                }}>
                  <div className="font-medium font-sans mb-1" style={{ color: isDay ? "#111" : "#F1F5F9", fontSize: 15, fontWeight: ["Pierwsze kroki", "Ekologiczny wybór", "Zielona inwestycja"].includes(m.title) ? 800 : 500 }}>{m.title}</div>
                  <div className="font-normal font-sans mb-2" style={{ color: isDay ? "#334155" : "#CBD5E1", fontSize: 13 }}>{m.description}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {/* Badge/ikona nagrody */}
                    {m.reward.includes('ViCoins') && <span style={{ fontSize: 15, background: '#fbbf24', borderRadius: 7, padding: '1.5px 6px', color: '#fff', fontWeight: 700, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>💰</span>}
                    {m.reward.includes('zanieczyszczenia') && <span style={{ fontSize: 15, background: '#10b981', borderRadius: 7, padding: '1.5px 6px', color: '#fff', fontWeight: 700, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>🌱</span>}
                    {/* Tekst nagrody */}
                    <span className={`font-semibold font-sans`} style={{ fontSize: 13, color: m.accent === "emerald" ? (isDay ? "#059669" : "#6ee7b7") : m.accent === "red" ? (isDay ? "#dc2626" : "#f87171") : (isDay ? "#334155" : "#CBD5E1") }}>{m.reward}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Sekcja ukończone misje */}
          <div>
            <div className="font-semibold text-sm mb-2" style={{ color: isDay ? "#10B981" : "#34D399", marginBottom: 18 }}>Ukończone misje</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {missions.filter(m => m.completed).length === 0 && (
                <div style={{ color: isDay ? "#64748b" : "#94a3b8", fontSize: 14, padding: 8 }}>Brak ukończonych misji</div>
              )}
              {missions.filter(m => m.completed).map(m => (
                <div key={m.key} style={{
                  borderRadius: 12,
                  background: isDay ? "#D1FAE5" : "#334155",
                  color: isDay ? undefined : "#F1F5F9",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                  padding: 12,
                  border: "1.5px solid #10B981",
                  opacity: 0.7,
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: 10
                }}>
                  <span style={{ fontSize: 17, color: isDay ? "#10B981" : "#34D399" }}>✓</span>
                  <div style={{ flex: 1 }}>
                    <div className="font-medium font-sans mb-1" style={{ color: isDay ? "#10B981" : "#34D399", fontSize: 14, fontWeight: ["Pierwsze kroki", "Ekologiczny wybór", "Zielona inwestycja"].includes(m.title) ? 800 : 500 }}>{m.title}</div>
                    <div className="font-normal font-sans mb-2" style={{ color: isDay ? "#334155" : "#CBD5E1", fontSize: 12 }}>{m.description}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {/* Badge/ikona nagrody z animacją po ukończeniu */}
                      {m.reward.includes('ViCoins') && <span style={{ fontSize: 15, background: '#fbbf24', borderRadius: 7, padding: '1.5px 6px', color: '#fff', fontWeight: 700, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', animation: 'reward-bounce 0.7s' }}>💰</span>}
                      {m.reward.includes('zanieczyszczenia') && <span style={{ fontSize: 15, background: '#10b981', borderRadius: 7, padding: '1.5px 6px', color: '#fff', fontWeight: 700, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', animation: 'reward-bounce 0.7s' }}>🌱</span>}
                      <span className={`font-semibold font-sans`} style={{ fontSize: 12, color: m.accent === "emerald" ? (isDay ? "#059669" : "#6ee7b7") : m.accent === "red" ? (isDay ? "#dc2626" : "#f87171") : (isDay ? "#334155" : "#CBD5E1") }}>{m.reward}</span>
                    </div>
                  </div>
                  {/* Animacja keyframes */}
                  <style>{`@keyframes reward-bounce{0%{transform:scale(0.7);}60%{transform:scale(1.2);}100%{transform:scale(1);}}`}</style>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

// ------- Iso grid -------
type IsoTileType = { id: string; x: number; y: number; entity?: { type: EntityType; icon: string; label: string } | null; isHome?: boolean };
function IsoGrid({
  tiles, homeTileId, onTileClick, pendingItem, lastPlacedKey, isPlaceable, weatherEvent, isDay
}: {
  tiles: IsoTileType[];
  homeTileId: string;
  onTileClick: (t: IsoTileType) => void;
  pendingItem: { name: string; icon: string } | null;
  lastPlacedKey: string | null;
  isPlaceable?: (t: IsoTileType) => boolean;
  weatherEvent: WeatherEvent;
  isDay: boolean;
}) {
  const tileW = 96, tileH = 48;
  const size = Math.sqrt(tiles.length);
  const baseX = (size - 1) * (tileW / 2);
  const baseY = 0;


  return (
    <div style={{ position: "relative", width: size * tileW, height: size * tileH, margin: "8px auto 0" }}>
      {/* Animacje pogodowe tylko nad mapą */}
      {weatherEvent && weatherEvent.type !== "none" && (
        <div style={{
          position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 3
        }}>
          {weatherEvent.type === "clouds" && (
            <span style={{ position: 'absolute', left: 12, top: 18, width: 32, height: 24, overflow: 'visible' }}>
              <span style={{
                position: 'absolute', left: 0, top: 0, fontSize: 32, opacity: 0.7,
                animation: 'cloud-move 2.5s linear infinite',
              }}>☁️</span>
              <span style={{
                position: 'absolute', left: 32, top: 8, fontSize: 24, opacity: 0.5,
                animation: 'cloud-move2 3.2s linear infinite',
              }}>☁️</span>
              <style>{`
                @keyframes cloud-move { 0%{left:0;} 100%{left:40px;} }
                @keyframes cloud-move2 { 0%{left:32px;} 100%{left:44px;} }
              `}</style>
            </span>
          )}
          {weatherEvent.type === "wind" && (
            <span style={{ position: 'absolute', left: '18%', top: 10, width: '64%', height: 60, pointerEvents: 'none' }}>
              <span style={{
                position: 'absolute', left: 0, top: 8, fontSize: 32, opacity: 0.7,
                animation: 'wind-move1 1.7s linear infinite',
              }}>🌬️</span>
              <span style={{
                position: 'absolute', left: -28, top: 28, fontSize: 24, opacity: 0.5,
                animation: 'wind-move2 2.2s linear infinite',
              }}>🌬️</span>
              <span style={{
                position: 'absolute', left: -38, top: 38, fontSize: 20, opacity: 0.4,
                animation: 'wind-move3 1.3s linear infinite',
              }}>🌬️</span>
              <style>{`
                @keyframes wind-move1 { 0%{left:0;} 100%{left:70%;} }
                @keyframes wind-move2 { 0%{left:-28px;} 100%{left:80%;} }
                @keyframes wind-move3 { 0%{left:-38px;} 100%{left:85%;} }
              `}</style>
            </span>
          )}
          {weatherEvent.type === "sunny" && (
            <span style={{ position: 'absolute', left: '50%', top: 10, transform: 'translateX(-50%)', fontSize: 36, animation: 'sun-spin 2.5s linear infinite' }}>🌞
              <style>{`@keyframes sun-spin { 0%{transform:translateX(-50%) rotate(0deg);} 100%{transform:translateX(-50%) rotate(360deg);} }`}</style>
            </span>
          )}
          {weatherEvent.type === "rain" && (
            <span style={{ position: 'absolute', left: 18, top: 10, width: 60, height: 36 }}>
              <span style={{ position: 'absolute', left: 0, top: 0, fontSize: 30 }}>🌧️</span>
              {/* Paski deszczu - poprawiona widoczność w dzień */}
              <span style={{
                position: 'absolute', left: 18, top: 18, width: 4, height: 16,
                background: isDay ? 'linear-gradient(to bottom, #2563eb 90%, transparent)' : 'linear-gradient(to bottom, #38bdf8 80%, transparent)',
                borderRadius: 2,
                opacity: isDay ? 0.95 : 0.7,
                animation: 'rain-bar 1.1s linear infinite',
                display: 'inline-block',
                boxShadow: isDay ? '0 0 4px 1px #2563eb55' : undefined,
              }}></span>
              <span style={{
                position: 'absolute', left: 28, top: 20, width: 3, height: 13,
                background: isDay ? 'linear-gradient(to bottom, #3b82f6 90%, transparent)' : 'linear-gradient(to bottom, #7dd3fc 80%, transparent)',
                borderRadius: 2,
                opacity: isDay ? 0.8 : 0.5,
                animation: 'rain-bar2 1.3s linear infinite',
                display: 'inline-block',
                boxShadow: isDay ? '0 0 3px 1px #3b82f655' : undefined,
              }}></span>
              <span style={{
                position: 'absolute', left: 38, top: 16, width: 2, height: 10,
                background: isDay ? 'linear-gradient(to bottom, #60a5fa 90%, transparent)' : 'linear-gradient(to bottom, #bae6fd 80%, transparent)',
                borderRadius: 2,
                opacity: isDay ? 0.7 : 0.4,
                animation: 'rain-bar3 1.5s linear infinite',
                display: 'inline-block',
                boxShadow: isDay ? '0 0 2px 1px #60a5fa55' : undefined,
              }}></span>
              <style>{`
                @keyframes rain-bar { 0%{top:18px;opacity:1;} 80%{top:32px;opacity:1;} 100%{top:18px;opacity:0;} }
                @keyframes rain-bar2 { 0%{top:20px;opacity:0.8;} 80%{top:36px;opacity:0.8;} 100%{top:20px;opacity:0;} }
                @keyframes rain-bar3 { 0%{top:16px;opacity:0.7;} 80%{top:30px;opacity:0.7;} 100%{top:16px;opacity:0;} }
              `}</style>
            </span>
          )}
          {weatherEvent.type === "frost" && (
            <span style={{
              position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none',
              display: 'block', zIndex: 2,
            }}>
              <span style={{
                position: 'absolute', left: 0, top: 0, width: '100%', height: '100%',
                background: 'linear-gradient(180deg, rgba(186,230,253,0.55) 0%, rgba(59,130,246,0.18) 80%, transparent 100%)',
                opacity: 0.85,
                animation: 'frost-fade 2.5s ease-in-out infinite',
              }}></span>
              <style>{`
                @keyframes frost-fade { 0%{opacity:0.7;} 50%{opacity:0.95;} 100%{opacity:0.7;} }
              `}</style>
            </span>
          )}
        </div>
      )}
      {tiles.map((t) => {
        const left = (t.x - t.y) * (tileW / 2) + baseX;
        const top = (t.x + t.y) * (tileH / 2) + baseY;
        const placeable = isPlaceable ? isPlaceable(t) : true;
        return (
          <IsoTile
            key={t.id}
            tile={t}
            left={left}
            top={top}
            w={tileW}
            h={tileH}
            onClick={() => onTileClick(t)}
            isHome={t.id === homeTileId}
            pendingItem={pendingItem}
            placeable={placeable}
            isNewlyPlaced={lastPlacedKey === t.id}
          />
        );
      })}
    </div>
  );
}

function IsoTile({
  tile, onClick, isHome, pendingItem, left, top, w, h, placeable, isNewlyPlaced,
}: {
  tile: { id: string; entity?: { type: string; icon: string; label: string } | null };
  onClick: () => void;
  isHome: boolean;
  pendingItem: { name: string; icon: string } | null;
  left: number; top: number; w: number; h: number;
  placeable: boolean;
  isNewlyPlaced: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [pop, setPop] = useState(false);

  useEffect(() => {
    if (isNewlyPlaced || tile.entity) {
      setPop(true);
      const t = setTimeout(() => setPop(false), 300);
      return () => clearTimeout(t);
    }
  }, [isNewlyPlaced, tile.entity]);

  const showGhost = hovered && placeable && !tile.entity && !!pendingItem;

  const baseFill = isHome ? "#FFF7ED" : "rgba(255,255,255,0.8)";
  const hoverFill = placeable ? "#E0F2FE" : "#FFE4E6";
  const downFill = placeable ? "#BAE6FD" : "#FECDD3";
  const stroke = hovered ? (placeable ? "#38BDF8" : "#FB7185") : "rgba(0,0,0,0.15)";
  const fill = pressed ? downFill : hovered ? hoverFill : baseFill;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      title={isHome ? "Dom" : tile.entity ? tile.entity.label : pendingItem ? `Postaw: ${pendingItem.name}` : "Pusty kafelek"}
      style={{
        position: "absolute", left, top, width: w, height: h,
        WebkitClipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)",
        clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)",
        border: "none", padding: 0, background: "transparent", cursor: placeable ? "pointer" : "not-allowed",
      }}
    >
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.1))", pointerEvents: "none" }}>
        <polygon points={`${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`} fill={fill} stroke={stroke} strokeWidth={1} shapeRendering="crispEdges" />
      </svg>
      <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none", willChange: "transform" }}>
        {isHome ? (
          <span style={{ fontSize: 18, display: "inline-block", transform: `scale(${pop ? 1.1 : 1})`, transition: "transform 300ms ease-out" }}>🏠</span>
        ) : tile.entity ? (
          <span style={{ fontSize: 18, display: "inline-block", transform: `scale(${pop ? 1.1 : 1})`, transition: "transform 300ms ease-out" }}>{tile.entity.icon}</span>
        ) : showGhost ? (
          <span style={{ fontSize: 20, opacity: 0.4, display: "inline-block", transform: `scale(${hovered ? 1.05 : 1})`, transition: "transform 200ms ease-out", animation: "pulse 1.2s ease-in-out infinite" }}>
            {pendingItem!.icon}
          </span>
        ) : null}
      </div>
      {/* keyframes pulse */}
      <style>{`@keyframes pulse{0%{opacity:.35}50%{opacity:.55}100%{opacity:.35}}`}</style>
    </button>
  );
}
