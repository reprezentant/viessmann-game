import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
// --- Typy bazowe ---
type ResKey = "sun" | "water" | "wind" | "coins";
// Urządzenia – klucze (z rozszerzoną sekwencją upgrade'ów na domu)
type EntityType =
  // Upgrade na domu (zastępują poprzednie)
  | "coal"                 // mapowane: Kocioł tradycyjny żeliwny (start)
  | "pellet"               // mapowane: Stalowy kocioł grzewczy (1917–1928)
  | "gas"                  // mapowane: Kocioł Triola (1957)
  | "parola1965"
  | "stainless1972"
  | "heatpump1978"
  | "vitola1978"
  | "vitodens1989"
  | "heatpump"            // Pompa ciepła (Vitocal)
  // Stawiane osobno
  | "forest"
  | "collector1972"
  | "inoxRadial"
  | "floor"
  | "thermostat"
  | "inverter"
  | "grid"
  | "solar"
  | "echarger"
  | "vitovalor2014";
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

// --- Klucze pomocnicze ---
const houseUpgradeKeys: EntityType[] = [
  "coal",
  "pellet",
  "gas",
  "parola1965",
  "stainless1972",
  "heatpump1978",
  "vitola1978",
  "vitodens1989",
  "heatpump",
];

const entityKeys: EntityType[] = [
  ...houseUpgradeKeys,
  "forest",
  "collector1972",
  "inoxRadial",
  "floor",
  "thermostat",
  "inverter",
  "grid",
  "solar",
  "echarger",
  "vitovalor2014",
];

const makeOwnedInit = (): Record<EntityType, number> => {
  const out: Partial<Record<EntityType, number>> = {};
  for (const k of entityKeys) out[k] = 0;
  return out as Record<EntityType, number>;
};

// --- Shop items (module scope for stability) ---
// Urządzenia (zakładka Urządzenia): wyłącznie łańcuch upgrade'ów na domu
const deviceItems: ShopItem[] = [
  { key: "coal", name: "Kocioł tradycyjny żeliwny", description: "Duże zanieczyszczenie, wysoka wydajność. Umieść na domu, aby go ogrzać.", icon: "🏚️", cost: { coins: 0 } },
  { key: "pellet", name: "Stalowy kocioł grzewczy (1917–1928)", description: "Trwalszy, szybciej się nagrzewa, mniejsze zużycie paliwa.", icon: "🔩", cost: { coins: 10 }, requires: ["coal"] },
  { key: "gas", name: "Kocioł Triola (1957)", description: "Stalowy piec z podgrzewaczem. Konwersja z koksu na olej.", icon: "🔥", cost: { sun: 15, water: 8, wind: 8 }, requires: ["pellet"] },
  { key: "parola1965", name: "Kocioł na olej Parola (1965)", description: "Niższe emisje i wysoka sprawność.", icon: "🛢️", cost: { sun: 25, water: 15, wind: 15 }, requires: ["gas"] },
  { key: "stainless1972", name: "Pierwszy kocioł ze stali nierdzewnej (1972)", description: "Lżejszy i wydajniejszy; prekursor kondensacji.", icon: "🧪", cost: { sun: 30, water: 20, wind: 20 }, requires: ["parola1965"] },
  { key: "heatpump1978", name: "Pierwsza pompa ciepła (1978)", description: "Wykorzystuje energię z otoczenia.", icon: "🌀", cost: { sun: 35, water: 25, wind: 25 }, requires: ["stainless1972"] },
  { key: "vitola1978", name: "Kocioł niskotemperaturowy Vitola (1978)", description: "Praca przy niższej temp. wody (większa efektywność).", icon: "♨️", cost: { sun: 15, water: 10, wind: 10 }, requires: ["heatpump1978"] },
  { key: "vitodens1989", name: "Kocioł gazowy Vitodens (1989)", description: "Kondensacja pary, wyższa sprawność, niższe emisje.", icon: "🔥💧", cost: { sun: 40, water: 25, wind: 25 }, requires: ["vitola1978"] },
  { key: "heatpump", name: "Pompa ciepła (Vitocal)", description: "Wysoka efektywność i OZE. Odblokowuje zielone instalacje.", icon: "🔋", cost: { sun: 60, water: 40, wind: 40 }, requires: ["vitodens1989"] },
];

const productionItems: ShopItem[] = [
  { key: "forest", name: "Las", description: "Silnie redukuje zanieczyszczenie (−0.5/s). Każdy kolejny jest droższy.", icon: "🌲", cost: { sun: 10, water: 10 } },
  { key: "collector1972", name: "Pierwszy kolektor słoneczny (1972)", description: "Więcej ☀️, mniej zanieczyszczeń, krótszy Mróz.", icon: "☀️", cost: { sun: 25, water: 10 }, requires: ["stainless1972"] },
  { key: "inoxRadial", name: "Technologia kondensacyjna (Inox‑Radial)", description: "Zmniejsza generowanie zanieczyszczeń.", icon: "🧰", cost: { sun: 20, water: 10, wind: 10 }, requires: ["vitodens1989"] },
  { key: "floor", name: "Ogrzewanie podłogowe", description: "Komfort. Skraca czas trwania Mrozu.", icon: "🧱", cost: { sun: 10, water: 10, wind: 5 }, requires: ["vitodens1989"] },
  { key: "thermostat", name: "Termostaty SRC", description: "Inteligentna regulacja – więcej zasobów.", icon: "🌡️", cost: { sun: 5, water: 5, wind: 5 }, requires: ["vitodens1989"] },
  { key: "solar", name: "Fotowoltaika (Vitovolt)", description: "Więcej ☀️.", icon: "🔆", cost: { sun: 20, wind: 10 }, requires: ["heatpump"] },
  { key: "inverter", name: "Inverter / magazyn (Vitocharge)", description: "Lepsza monetyzacja – więcej 💰.", icon: "🔶", cost: { sun: 20, water: 10, wind: 10 }, requires: ["heatpump"] },
  { key: "grid", name: "Grid", description: "Wymiana energii – więcej 💰.", icon: "⚡", cost: { sun: 10, water: 10, wind: 20 }, requires: ["heatpump"] },
  { key: "vitovalor2014", name: "Vitovalor (2014)", description: "Ogniwo paliwowe – silnie redukuje zanieczyszczenie.", icon: "🧫", cost: { sun: 35, water: 20, wind: 20 }, requires: ["heatpump"] },
  { key: "echarger", name: "E-Charger", description: "+5 💰/min.", icon: "🔌", cost: { wind: 20, water: 20 }, requires: ["heatpump"] },
];

// --- Helper index for entity metadata ---
const itemByKey: Record<EntityType, ShopItem> = Object.fromEntries(
  [...deviceItems, ...productionItems].map(i => [i.key, i])
) as Record<EntityType, ShopItem>;
const instanceFor = (k: EntityType): EntityInstance => {
  const it = itemByKey[k];
  return { type: k, label: it?.name || k, icon: it?.icon || "" };
};

// --- Typy wydarzeń pogodowych ---
type WeatherEventType = "none" | "clouds" | "sunny" | "rain" | "frost" | "wind" | "storm";
type WeatherEvent = {
  type: WeatherEventType;
  duration: number; // sekundy
  remaining: number; // sekundy
};

// --- Sezony ---
type SeasonType = 'spring' | 'summer' | 'autumn' | 'winter';
type SeasonState = { type: SeasonType; duration: number; remaining: number };

// --- Profile system types ---
type Achievement = {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: Date;
};

// --- Log types ---
type LogType = 'purchase' | 'placement' | 'mission' | 'weather' | 'achievement' | 'milestone' | 'other';
type LogEntry = {
  id: string;
  at: number; // timestamp ms
  icon?: string;
  title: string;
  description?: string;
  type?: LogType;
};

// --- Achievements: definitions outside component for stability ---
type AchievementDef = {
  id: string;
  name: string;
  description: string;
  icon: string;
  check: (ctx: AchCtx) => boolean;
};
type AchCtx = { owned: Record<EntityType | "coal", number> };

const achievementDefs: AchievementDef[] = [
  {
    id: "first-steps",
  name: "Pierwsze kroki",
  description: "Postaw swój pierwszy budynek",
    icon: "🏠",
    check: ({ owned }) => Object.values(owned).reduce((a, b) => a + (b || 0), 0) >= 1,
  },
  {
    id: "heat-source",
  name: "Źródło ciepła",
  description: "Posiadaj urządzenie grzewcze",
    icon: "🔥",
    check: ({ owned }) => (owned.coal ?? 0) > 0 || (owned.pellet ?? 0) > 0 || (owned.gas ?? 0) > 0 || (owned.heatpump ?? 0) > 0,
  },
  {
    id: "going-green",
  name: "Zielona energia",
  description: "Zainstaluj odnawialne źródło energii",
    icon: "🌿",
    check: ({ owned }) => (owned.solar ?? 0) > 0 || (owned.forest ?? 0) > 0 || (owned.heatpump ?? 0) > 0,
  },
  {
    id: "power-up",
  name: "Moc w sieci",
  description: "Zbuduj infrastrukturę energetyczną",
    icon: "⚡",
    check: ({ owned }) => (owned.inverter ?? 0) > 0 && (owned.grid ?? 0) > 0,
  },
  // New, more granular goals
  {
    id: "coal-installed",
    name: "Tradycja na dachu",
    description: "Zainstaluj kocioł węglowy",
    icon: "🧱",
    check: ({ owned }) => (owned.coal ?? 0) > 0,
  },
  {
    id: "pellet-installed",
    name: "Pelletowy upgrade",
    description: "Zainstaluj kocioł na pellet",
    icon: "🔩",
    check: ({ owned }) => (owned.pellet ?? 0) > 0,
  },
  {
    id: "gas-installed",
    name: "Gazowe ogrzewanie",
    description: "Zainstaluj kocioł gazowy",
    icon: "🔥",
    check: ({ owned }) => (owned.gas ?? 0) > 0,
  },
  {
    id: "heatpump-installed",
    name: "Pompa ciepła",
    description: "Zainstaluj pompę ciepła",
    icon: "🌀",
    check: ({ owned }) => (owned.heatpump ?? 0) > 0,
  },
  {
    id: "solar-starter",
    name: "Pierwszy panel",
    description: "Postaw panel fotowoltaiczny",
    icon: "☀️",
    check: ({ owned }) => (owned.solar ?? 0) > 0,
  },
  {
    id: "solar-farm",
    name: "Mała farma",
    description: "Postaw 3 panele fotowoltaiczne",
    icon: "☀️",
    check: ({ owned }) => (owned.solar ?? 0) >= 3,
  },
  {
    id: "forest-planted",
    name: "Zielony zakątek",
    description: "Posadź las",
    icon: "🌳",
    check: ({ owned }) => (owned.forest ?? 0) > 0,
  },
  {
    id: "ev-ready",
    name: "EV ready",
    description: "Zainstaluj E‑Charger",
    icon: "🔌",
    check: ({ owned }) => (owned.echarger ?? 0) > 0,
  },
];

export default function ViessmannGame() {
  // --- Wszystkie stany i stałe na początek ---
  // Pogoda
  const [weatherEvent, setWeatherEvent] = useState<WeatherEvent>({ type: "none", duration: 0, remaining: 0 });
  // Sezony: rzadziej zmieniane, wpływają na produkcję i tempo smogu
  const SEASON_LENGTH = 150; // sekundy
  const [season, setSeason] = useState<SeasonState>({ type: 'spring', duration: SEASON_LENGTH, remaining: SEASON_LENGTH });
  // Odliczanie sezonu
  useEffect(() => {
    const id = setInterval(() => {
      setSeason(s => ({ ...s, remaining: Math.max(0, s.remaining - 1) }));
    }, 1000);
    return () => clearInterval(id);
  }, []);
  // Zmiana sezonu po wyczerpaniu czasu
  useEffect(() => {
    if (season.remaining > 0) return;
    const order: SeasonType[] = ['spring','summer','autumn','winter'];
    const idx = order.indexOf(season.type);
    const next = order[(idx + 1) % order.length];
    setSeason({ type: next, duration: SEASON_LENGTH, remaining: SEASON_LENGTH });
  }, [season.remaining, season.type]);
  const WEATHER_EVENT_INTERVAL = 30; // co ile sekund losować nowe wydarzenie
  const WEATHER_EVENT_DURATION = 25; // ile trwa wydarzenie
  const FROST_EVENT_DURATION = 30; // ile trwa mróz
  const STORM_EVENT_DURATION = 20; // ile trwa burza (rzadka, ale silna)
  // Zasoby
  const [resources, setResources] = useState<Record<ResKey, number>>({ sun: 0, water: 0, wind: 0, coins: 0 });
  const [baseRates, setBaseRates] = useState<Record<ResKey, number>>({ sun: 0.02, wind: 0.02, water: 0.02, coins: 0.05 });
  const TICK_MS = 1000;
  // Zanieczyszczenie
  const [pollution, setPollution] = useState(0);
  const [pollutionRate, setPollutionRate] = useState(0);
  const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));
  const addPollutionRate = (d: number) => setPollutionRate((p) => Math.max(-2, p + d));
  // Sezonowy wkład do pollutionRate (delta vs poprzedni sezon)
  const seasonDeltaRef = useRef(0);
  const seasonPollutionFor = (t: SeasonType): number => {
    switch (t) {
      case 'spring': return -0.01;
      case 'summer': return -0.02;
      case 'autumn': return 0.0;
      case 'winter': return +0.05;
    }
  };
  useEffect(() => {
    const next = seasonPollutionFor(season.type);
    const prev = seasonDeltaRef.current;
    if (next !== prev) {
      addPollutionRate(next - prev);
      seasonDeltaRef.current = next;
    }
  }, [season.type]);
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
        else if (roll < 0.83) type = "storm"; // rzadsze
      } else {
        if (roll < 0.225) type = "clouds";
        else if (roll < 0.45) type = "rain";
        else if (roll < 0.65) type = "wind";
        else if (roll < 0.8) type = "frost";
        else if (roll < 0.85) type = "storm"; // rzadkie w nocy
      }
      if (type === "frost") {
        setWeatherEvent({ type, duration: FROST_EVENT_DURATION, remaining: FROST_EVENT_DURATION });
      } else if (type === "storm") {
        setWeatherEvent({ type, duration: STORM_EVENT_DURATION, remaining: STORM_EVENT_DURATION });
      } else if (type !== "none") {
        setWeatherEvent({ type, duration: WEATHER_EVENT_DURATION, remaining: WEATHER_EVENT_DURATION });
      }
    }, WEATHER_EVENT_INTERVAL * 1000);
    return () => clearInterval(interval);
  }, [weatherEvent.type, isDay]);

  // Dev-only: quick weather forcing via keyboard
  useEffect(() => {
    // Only active in dev environment
    const isDev = typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV;
    if (!isDev) return;
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      const map: Record<string, WeatherEventType> = { '0': 'none', '1': 'clouds', '2': 'sunny', '3': 'rain', '4': 'wind', '5': 'frost', '6': 'storm' };
      if (!(k in map)) return;
      const t = map[k];
      if (t === 'none') {
        setWeatherEvent({ type: 'none', duration: 0, remaining: 0 });
      } else if (t === 'frost') {
        setWeatherEvent({ type: 'frost', duration: FROST_EVENT_DURATION, remaining: FROST_EVENT_DURATION });
      } else {
        setWeatherEvent({ type: t, duration: WEATHER_EVENT_DURATION, remaining: WEATHER_EVENT_DURATION });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const weatherMultipliers: Record<ResKey, number> = useMemo(() => {
  if (weatherEvent.type === "clouds") return { sun: 0, water: 1, wind: 1, coins: 1 };
  if (weatherEvent.type === "sunny") return { sun: 2, water: 1, wind: 1, coins: 1 };
  if (weatherEvent.type === "rain") return { sun: 1, water: 2, wind: 1, coins: 1 };
  if (weatherEvent.type === "wind") return { sun: 0.5, water: 0.7, wind: 2, coins: 1 };
  if (weatherEvent.type === "storm") return { sun: 0, water: 1.5, wind: 3, coins: 1 };
  if (weatherEvent.type === "frost") return { sun: 0, water: 0, wind: 0, coins: 0 };
  return { sun: 1, water: 1, wind: 1, coins: 1 };
  }, [weatherEvent.type]);
  // Smog pressure: reduce production as pollution grows (never zero; keeps game moving)
  const smogMultiplier = useMemo(() => {
    const p = pollution;
    if (p <= 20) return 1.0;
    if (p >= 95) return 0.2;
    if (p >= 80) {
      // 80 -> 0.3 down to 95 -> 0.2
      const t = (p - 80) / 15;
      return +(0.3 - 0.1 * t);
    }
    if (p >= 60) return 0.6;
    if (p >= 40) return 0.9;
    // 20-40 soft approach from 1.0 to 0.95
    const t = (p - 20) / 20;
    return +(1 - 0.05 * t);
  }, [pollution]);
  // Clean-air bonus: reward low smog with a small coin boost (stacks after smog multiplier)
  const ecoBonusMultiplier = useMemo(() => {
    const p = pollution;
    if (p <= 10) return 1.15; // +15% when very clean
    if (p < 25) return +(1.0 + (25 - p) * 0.01); // linearly fades from +15% at 10 to 0% at 25
    return 1.0;
  }, [pollution]);
  // Smog stage change notifications (one-off per stage)
  const smogStageRef = useRef<number>(-1);
  const smogHydratedRef = useRef(false);
  useEffect(() => {
    // Stages: 0:<40, 1:40-59, 2:60-79, 3:80+
    const s = pollution < 40 ? 0 : pollution < 60 ? 1 : pollution < 80 ? 2 : 3;
    if (!smogHydratedRef.current) { smogHydratedRef.current = true; smogStageRef.current = s; return; }
    if (s !== smogStageRef.current) {
      const map = [
        { icon: '🌿', msg: 'Smog niski – pełna produkcja.' },
        { icon: '⚠️', msg: 'Uwaga: wzrost smogu – niewielka kara produkcji.' },
        { icon: '🛑', msg: 'Wysoki smog – silna kara produkcji.' },
        { icon: '⛔', msg: 'Krytyczny smog – produkcja mocno ograniczona.' },
      ];
      const info = map[s];
      pushToast({ icon: info.icon, text: info.msg });
      pushLog({ type: 'other', icon: info.icon, title: 'Poziom smogu zmieniony', description: info.msg });
      smogStageRef.current = s;
    }
  }, [pollution]);
  // Mnożniki sezonowe
  const seasonMultipliers: Record<ResKey, number> = useMemo(() => {
    switch (season.type) {
      case 'spring': return { sun: 1.0, water: 1.3, wind: 1.0, coins: 1.0 };
      case 'summer': return { sun: 1.3, water: 1.1, wind: 0.9, coins: 1.0 };
      case 'autumn': return { sun: 0.9, water: 1.2, wind: 1.2, coins: 1.0 };
      case 'winter': return { sun: 0.7, water: 0.9, wind: 1.2, coins: 1.0 };
    }
  }, [season.type]);
  const phasePct = useMemo(() => {
    const mod = elapsed % DAY_LENGTH;
    const dayLen = DAY_LENGTH * DAY_FRACTION;
    const nightLen = DAY_LENGTH - dayLen;
    if (mod < dayLen) return (mod / dayLen) * 100;
    return ((mod - dayLen) / nightLen) * 100;
  }, [elapsed]);

  // --- Mnożniki: dzień/noc * sezon * wydarzenie pogodowe ---
  const dayNightMultipliers: Record<ResKey, number> = useMemo(() => (
    isDay ? { sun: 2.0, wind: 1.0, water: 1.0, coins: 1.0 } : { sun: 0.0, wind: 1.2, water: 1.0, coins: 1.0 }
  ), [isDay]);
  const multipliers: Record<ResKey, number> = useMemo(() => {
    // Połącz z sezonem i pogodą
    return {
    sun: dayNightMultipliers.sun * seasonMultipliers.sun * weatherMultipliers.sun * smogMultiplier,
    wind: dayNightMultipliers.wind * seasonMultipliers.wind * weatherMultipliers.wind * smogMultiplier,
    water: dayNightMultipliers.water * seasonMultipliers.water * weatherMultipliers.water * smogMultiplier,
    // coins additionally benefit from ecoBonusMultiplier when air is clean
    coins: dayNightMultipliers.coins * seasonMultipliers.coins * weatherMultipliers.coins * smogMultiplier * ecoBonusMultiplier,
    };
  }, [dayNightMultipliers, seasonMultipliers, weatherMultipliers, smogMultiplier, ecoBonusMultiplier]);
  const [renewablesUnlocked, setRenewablesUnlocked] = useState(false);
  const effectiveRates = useMemo(
    () => ({
      sun: +(baseRates.sun * multipliers.sun),
      wind: +(baseRates.wind * multipliers.wind),
      water: +(baseRates.water * multipliers.water),
      coins: +(baseRates.coins * multipliers.coins),
    }),
    [baseRates, multipliers]
  );
  // (Ekonomia panel removed)

  // ---------- Map ----------
  const SIZE = 7;
  const CENTER = Math.floor(SIZE / 2);
  const createInitialTiles = useCallback((): Tile[] => {
    const list: Tile[] = [];
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      list.push({ id: `${x},${y}`, x, y, entity: null, isHome: x === CENTER && y === CENTER });
    }
    return list;
  }, [SIZE, CENTER]);
  const [tiles, setTiles] = useState<Tile[]>(() => createInitialTiles());
  const homeTileId = `${CENTER},${CENTER}`;
  // Liczba faktycznie postawionych obiektów (z mapy), do misji i osiągnięć
  const placedCounts: Record<EntityType | 'coal', number> = useMemo(() => {
    const counts: Record<EntityType | 'coal', number> = {
      coal: 0, pellet: 0, gas: 0, floor: 0, thermostat: 0, heatpump: 0, inverter: 0, grid: 0, solar: 0, echarger: 0, forest: 0,
    } as Record<EntityType | 'coal', number>;
    for (const t of tiles) {
      if (t.entity) {
        const k = t.entity.type as EntityType;
        counts[k] = (counts[k] ?? 0) + 1;
      }
    }
    return counts;
  }, [tiles]);

  // ---------- Shop ----------
  const [priceDiscountPct, setPriceDiscountPct] = useState(0);
  const [owned, setOwned] = useState<Record<EntityType | "coal", number>>(() => makeOwnedInit());


  const [shopTab, setShopTab] = useState<"devices" | "production">("devices");
  const isSinglePurchase = (k: EntityType) => !["solar", "echarger", "forest"].includes(k);

  const [hasECharger, setHasECharger] = useState(false);
  const echargerBonusRef = useRef(0);
  // Track house device's pollution contribution to adjust cleanly on upgrades
  const housePollutionRef = useRef(0);
  const [pendingPlacement, setPendingPlacement] = useState<ShopItem | null>(null);
  const [lastPlacedKey, setLastPlacedKey] = useState<string | null>(null);

  // Keep renewables unlocked in sync based on current tiles (heatpump presence)
  useEffect(() => {
    const anyHeatpump = tiles.some(t => t.entity?.type === 'heatpump');
    if (anyHeatpump !== renewablesUnlocked) setRenewablesUnlocked(anyHeatpump);
  }, [tiles, renewablesUnlocked]);

  // -------- Save system v1 (tiles/resources/pollution) --------
  type SaveV1 = {
    v: 1;
    resources: Record<ResKey, number>;
    pollution: number;
    tiles: Array<{ id: string; x: number; y: number; isHome?: boolean; entity?: EntityType | null }>;
  season?: { type: SeasonType; remaining: number };
  };
  const SAVE_KEY = 'vm_save_v1';
  // Load once on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as SaveV1;
      if (!data || data.v !== 1) return;
      if (data.resources) setResources(r => ({ ...r, ...data.resources }));
      if (typeof data.pollution === 'number') setPollution(data.pollution);
      if (data.season && data.season.type) {
  setSeason({ type: data.season!.type, duration: SEASON_LENGTH, remaining: Math.min(SEASON_LENGTH, Math.max(0, data.season!.remaining)) });
        // initialize seasonal delta to loaded season so it doesn't double-apply on first tick
        seasonDeltaRef.current = seasonPollutionFor(data.season.type);
      }
      if (Array.isArray(data.tiles) && data.tiles.length) {
        const map = new Map<string, { id: string; x: number; y: number; isHome?: boolean; entity?: EntityType | null }>();
        data.tiles.forEach(t => map.set(t.id, t));
        setTiles(prev => prev.map(t => {
          const s = map.get(t.id);
          if (!s) return t;
          return {
            ...t,
            entity: s.entity ? instanceFor(s.entity) : null,
          };
        }));
          // Rebuild pollutionRate baseline from saved tiles (house + forests)
          const home = data.tiles.find(t => t.isHome);
          const houseType = (home?.entity as EntityType | null | undefined) ?? null;
          const forests = data.tiles.filter(t => t.entity === 'forest').length;
          const base = housePollutionFor(houseType) + (-0.5 * forests);
          setPollutionRate(Math.max(-2, base));
          housePollutionRef.current = housePollutionFor(houseType);
      }
    } catch { /* ignore */ }
  }, []);
  // Persist on changes
  useEffect(() => {
    try {
      const save: SaveV1 = {
        v: 1,
        resources,
        pollution,
  tiles: tiles.map(t => ({ id: t.id, x: t.x, y: t.y, isHome: t.isHome, entity: t.entity?.type ?? null })),
  season: { type: season.type, remaining: season.remaining },
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch { /* ignore */ }
  }, [tiles, resources, pollution, season]);

  // Export/import helpers
  const exportSave = useCallback(() => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      const payload = raw || JSON.stringify({ v: 1, resources, pollution, tiles: tiles.map(t => ({ id: t.id, x: t.x, y: t.y, isHome: t.isHome, entity: t.entity?.type ?? null })) });
      const name = `viessmann-save-${Date.now()}.json`;
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
    } catch { /* ignore */ }
  }, [tiles, resources, pollution]);

  const importInputRef = useRef<HTMLInputElement | null>(null);
  const onImportFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const data = JSON.parse(text) as SaveV1;
        if (!data || data.v !== 1) return;
        setResources(r => ({ ...r, ...data.resources }));
        setPollution(typeof data.pollution === 'number' ? data.pollution : 0);
        if (Array.isArray(data.tiles) && data.tiles.length) {
          const map = new Map<string, { id: string; x: number; y: number; isHome?: boolean; entity?: EntityType | null }>();
          data.tiles.forEach(t => map.set(t.id, t));
          setTiles(createInitialTiles().map(t => {
            const s = map.get(t.id);
            if (!s) return t;
            return { ...t, entity: s.entity ? instanceFor(s.entity) : null };
          }));
            if (data.season && data.season.type) {
              setSeason({ type: data.season!.type, duration: SEASON_LENGTH, remaining: Math.min(SEASON_LENGTH, Math.max(0, data.season!.remaining)) });
              seasonDeltaRef.current = seasonPollutionFor(data.season.type);
            }
          // Restore pollutionRate baseline on import
          const home = data.tiles.find(t => t.isHome);
          const houseType = (home?.entity as EntityType | null | undefined) ?? null;
          const forests = data.tiles.filter(t => t.entity === 'forest').length;
          const base = housePollutionFor(houseType) + (-0.5 * forests);
          setPollutionRate(Math.max(-2, base));
          housePollutionRef.current = housePollutionFor(houseType);
        }
      } catch { /* ignore */ }
    };
    reader.readAsText(f);
    // reset input to allow importing the same file again if needed
    e.target.value = '';
  }, [createInitialTiles]);

  // Reset game (Nowa gra)
  const resetGame = useCallback(() => {
    const ok = window.confirm('Na pewno rozpocząć nową grę? Spowoduje to utratę postępów.');
    if (!ok) return;
    try {
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem('vm_log');
      localStorage.removeItem('vm_achUnlocked');
      localStorage.removeItem('vm_seen_ach');
      localStorage.removeItem('vm_seen_log');
    } catch { /* ignore */ }
    setTiles(createInitialTiles());
    setResources({ sun: 0, water: 0, wind: 0, coins: 0 });
    setPollution(0);
    setPollutionRate(0);
    setRenewablesUnlocked(false);
    setPriceDiscountPct(0);
    setOwned(makeOwnedInit());
    setHasECharger(false);
    echargerBonusRef.current = 0;
  housePollutionRef.current = 0;
    setPendingPlacement(null);
    setLastPlacedKey(null);
    setLog([]);
    setLoggedMilestones({});
    setMissions(prev => prev.map(m => ({ ...m, completed: false })));
    setShowAchievements(false);
    setShowMissions(false);
    setShowLog(false);
    setShowProfileMenu(false);
  }, [createInitialTiles]);

  // -------- Missions progress --------
  type MissionProgress = { value: number; max: number; label: string };
  const missionProgress = useMemo<Record<string, MissionProgress>>(() => {
    const mp: Record<string, MissionProgress> = {};
    const bin = (done: boolean): MissionProgress => ({ value: done ? 1 : 0, max: 1, label: done ? '1/1' : '0/1' });
    const has = (k: EntityType) => (placedCounts[k] ?? 0) > 0;
    // Binary missions mapped to entities
    const mapBin: Array<[string, EntityType]> = [
      ['first-steps','coal'], ['eco-choice','pellet'], ['triola-gas','gas'], ['parola-1965','parola1965'],
      ['stainless-1972','stainless1972'], ['heatpump-1978','heatpump1978'], ['vitola-1978','vitola1978'], ['vitodens-1989','vitodens1989'],
      ['vitocal-modern','heatpump'], ['green-investment','forest'], ['collector-1972','collector1972'], ['pv-vitovolt','solar'],
      ['vitocharge-inverter','inverter'], ['grid-connect','grid'], ['vitovalor-2014','vitovalor2014'], ['floor-heat','floor'],
      ['thermostats-src','thermostat'], ['inox-radial','inoxRadial']
    ];
    for (const [k, ent] of mapBin) mp[k] = bin(has(ent));
    // Composite: future-home (heatpump + solar + grid)
    const fhParts = ['heatpump','solar','grid'] as const;
    const fhHave = fhParts.filter(k => has(k)).length;
    mp['future-home'] = { value: fhHave, max: fhParts.length, label: `${fhHave}/${fhParts.length}` };
    // Zero smog: require combo + pollution <= 10; show progress toward 10
    const comboReady = ['heatpump','inoxRadial','solar','grid'].every(k => has(k as EntityType));
    const val = pollution <= 10 ? 1 : Math.min(1, 10 / Math.max(10, pollution));
    mp['zero-smog'] = { value: comboReady ? val : 0, max: 1, label: comboReady ? (pollution <= 10 ? '1/1' : `cel: ≤10 (teraz: ${Math.round(pollution)})`) : '0/1' };
    return mp;
  }, [placedCounts, pollution]);
  // Allow canceling placement with Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPendingPlacement(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Profile menu states
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showMissions, setShowMissions] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [logFilter, setLogFilter] = useState<'all' | LogType>('all');
  // Weather legend fixed overlay state
  const [legendOpen, setLegendOpen] = useState(false);
  const [legendPos, setLegendPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  // Custom tooltips for Season and Pollution (native title can be flaky on frequent updates)
  const [seasonTipOpen, setSeasonTipOpen] = useState(false);
  const [seasonTipPos, setSeasonTipPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const [pollTipOpen, setPollTipOpen] = useState(false);
  const [pollTipPos, setPollTipPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  // (Ekonomia panel state removed)

  // Activity log
  const inferLogType = (e: { title?: string; type?: LogType }): LogType => {
    if (e.type) return e.type;
    const t = (e.title || "").toLowerCase();
    if (t.startsWith("zakupiono:")) return 'purchase';
    if (t.startsWith("ustawiono:")) return 'placement';
    if (t.startsWith("ukończono misję:") || t.startsWith("ukonczono misję:") || t.startsWith("ukonczono misje:")) return 'mission';
    if (t.startsWith("zdarzenie pogodowe:")) return 'weather';
    if (t.startsWith("osiągnięcie:") || t.startsWith("osiagniecie:")) return 'achievement';
    if (t.startsWith("kamień milowy:") || t.startsWith("kamien milowy:")) return 'milestone';
    return 'other';
  };
  const [log, setLog] = useState<LogEntry[]>([]);
  // Dedup map for logs: key => last timestamp
  const logDedupRef = useRef<Record<string, number>>({});
  const pushLog = (entry: Omit<LogEntry, "id" | "at"> & { at?: number }) => {
    const now = Date.now();
    const key = `${entry.type}|${entry.title}`;
    const last = logDedupRef.current[key] || 0;
    // Skip if a same-type+title log was added very recently (dev StrictMode double effects)
    if (now - last < 1500) return;
    logDedupRef.current[key] = now;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const at = entry.at ?? now;
    setLog(prev => [
      { id, at, icon: entry.icon, title: entry.title, description: entry.description, type: entry.type },
      ...prev
    ].slice(0, 200));
  };
  // Load log from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('vm_log');
      if (raw) {
        const parsed = JSON.parse(raw) as LogEntry[];
        if (Array.isArray(parsed)) {
          // Migrate missing types using title heuristics
          const migrated = parsed.map(e => ({ ...e, type: inferLogType(e) }));
          setLog(migrated);
        }
      }
  } catch { /* ignore */ }
  }, []);
  // Persist log
  useEffect(() => {
  try { localStorage.setItem('vm_log', JSON.stringify(log)); } catch { /* ignore */ }
  }, [log]);

  // (moved) Log newly unlocked achievements is declared after achUnlocked

  // Resource milestones (100, 500, 1000)
  const [loggedMilestones, setLoggedMilestones] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const thresholds = [100, 500, 1000];
    const keys: { k: ResKey; icon: string; label: string }[] = [
      { k: 'sun', icon: '☀️', label: 'Słońce' },
      { k: 'water', icon: '💧', label: 'Woda' },
      { k: 'wind', icon: '🌬️', label: 'Wiatr' },
      { k: 'coins', icon: '💰', label: 'ViCoins' },
    ];
    const updates: Record<string, boolean> = {};
  const toLog: Array<{ type: LogType; icon: string; title: string; description: string }> = [];
    for (const t of thresholds) {
      for (const { k, icon, label } of keys) {
        const key = `${k}-${t}`;
        if (!loggedMilestones[key] && (resources[k] ?? 0) >= t) {
          updates[key] = true;
          toLog.push({ type: 'milestone', icon, title: `Kamień milowy: ${label} ${t}`, description: `Osiągnięto poziom ${t} dla ${label}.` });
        }
      }
    }
    if (toLog.length) {
      setLoggedMilestones(prev => ({ ...prev, ...updates }));
  toLog.forEach(e => pushLog(e));
    }
  }, [resources, loggedMilestones]);

  // Achievements state: unlocked map with timestamps
  const [achUnlocked, setAchUnlocked] = useState<Record<string, number>>({});
  // Load achievements from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('vm_achUnlocked');
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, number>;
        if (parsed && typeof parsed === 'object') setAchUnlocked(parsed);
      }
  } catch { /* ignore */ }
  }, []);

  // Recompute unlocks when placed items change (placement-based achievements)
  useEffect(() => {
    const ctx: AchCtx = { owned: placedCounts };
    const newly = achievementDefs.filter(def => !achUnlocked[def.id] && def.check(ctx));
    if (newly.length === 0) return;
    setAchUnlocked(prev => {
      const now = Date.now();
      const n = { ...prev } as Record<string, number>;
      newly.forEach((def, i) => { n[def.id] = now + i; });
      return n;
    });
  }, [placedCounts, achUnlocked]);

  // Derived achievements for UI
  const achievements: Achievement[] = useMemo(() => (
    achievementDefs
      .map(def => ({
        id: def.id,
        name: def.name,
        description: def.description,
        icon: def.icon,
        unlocked: !!achUnlocked[def.id],
        unlockedAt: achUnlocked[def.id] ? new Date(achUnlocked[def.id]) : undefined,
      }))
      .sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || ((b.unlockedAt?.getTime?.() || 0) - (a.unlockedAt?.getTime?.() || 0)))
  ), [achUnlocked]);
  // Persist achievements map
  useEffect(() => {
    try { localStorage.setItem('vm_achUnlocked', JSON.stringify(achUnlocked)); } catch { /* ignore */ }
  }, [achUnlocked]);

  // Last seen times + badges (define after achUnlocked)
  const [lastSeenAchievements, setLastSeenAchievements] = useState<number>(() => Number(localStorage.getItem('vm_seen_ach') || 0));
  const [lastSeenLog, setLastSeenLog] = useState<number>(() => Number(localStorage.getItem('vm_seen_log') || 0));
  const hasNewAchievements = useMemo(() => Object.values(achUnlocked).some(ts => ts > lastSeenAchievements), [achUnlocked, lastSeenAchievements]);
  const hasNewLog = useMemo(() => log.some(e => e.at > lastSeenLog), [log, lastSeenLog]);

  // Log newly unlocked achievements
  const prevAchRef = useRef<Record<string, number>>({});
  // Skip first run after hydration to avoid logging already-unlocked achievements on dev remount
  const achHydratedOnceRef = useRef(false);
  useEffect(() => {
    if (!achHydratedOnceRef.current) {
      achHydratedOnceRef.current = true;
      // Treat current state as baseline
      prevAchRef.current = { ...achUnlocked };
      return;
    }
    const prev = prevAchRef.current || {};
    const added = Object.keys(achUnlocked).filter(id => !prev[id]);
    if (added.length) {
      added.forEach(id => {
        const def = achievementDefs.find(d => d.id === id);
        if (def) {
          pushLog({ type: 'achievement', icon: def.icon, title: `Osiągnięcie: ${def.name}`, description: def.description });
          pushToast({ icon: '🔔', text: `Nowe osiągnięcie: ${def.name}` });
        }
      });
      prevAchRef.current = { ...achUnlocked };
    }
  }, [achUnlocked]);

  // Toasts
  type Toast = { id: string; icon?: string; text: string };
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Dedup map for toasts: text => last timestamp
  const toastDedupRef = useRef<Record<string, number>>({});
  const pushToast = ({ icon, text }: { icon?: string; text: string }) => {
    const now = Date.now();
    const last = toastDedupRef.current[text] || 0;
    if (now - last < 1200) return; // ignore duplicates fired too quickly
    toastDedupRef.current[text] = now;
    const id = `${now}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, icon, text }]);
    setTimeout(() => setToasts((prev) => prev.filter(t => t.id !== id)), 3500);
  };
  const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  // Helpers
  const canAfford = (c: Cost) => Object.entries(c).every(([k, v]) => (resources as Record<string, number>)[k] >= (v ?? 0));
  const discountedCost = (cost: Cost): Cost => {
    if (!priceDiscountPct) return cost; const out: Cost = {};
    for (const [k, v] of Object.entries(cost)) if (typeof v === "number") out[k as ResKey] = Math.ceil(v * (1 - priceDiscountPct / 100));
    return out;
  };
  // Dynamic pricing for forests: base 10/10 plus +8/+8 per owned forest
  const dynamicCost = (item: ShopItem): Cost => {
    // start with discounted base cost
    const base = discountedCost(item.cost);
    if (item.key !== 'forest') return base;
    const count = owned.forest ?? 0;
    const bump = 8 * count;
    return {
      ...base,
      sun: (base.sun ?? 0) + bump,
      water: (base.water ?? 0) + bump,
    };
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
  // Pollution contribution per house device
  const housePollutionFor = (k: EntityType | null | undefined): number => {
    switch (k) {
      case 'coal': return 0.4;
      case 'pellet': return 0.3;
      case 'gas': return 0.2;
      case 'parola1965': return 0.12;
      case 'stainless1972': return 0.08;
      case 'heatpump1978': return 0.06;
      case 'vitola1978': return 0.04;
      case 'vitodens1989': return 0.02;
      case 'heatpump': return 0.0;
      default: return 0.0;
    }
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
    const home = tiles.find(t => t.isHome);
    const currentKey = home?.entity && houseUpgradeKeys.includes(home.entity.type as EntityType)
      ? (home.entity.type as EntityType)
      : undefined;
    const currentIdx = currentKey ? houseUpgradeKeys.indexOf(currentKey) : -1;
    // Show only the next immediate upgrade in the house chain
    return deviceItems.filter(it => {
      const idx = houseUpgradeKeys.indexOf(it.key);
      if (currentIdx < 0) return idx === 0; // no device yet -> show first
      return idx === currentIdx + 1; // show only the next stage
    });
  }, [tiles]);

  const visibleProduction = useMemo(() => productionItems.filter(it => !it.requires || it.requires.every(k => owned[k] > 0)), [owned]);

  // Zakup
  const handleBuy = (item: ShopItem) => {
    if (isSinglePurchase(item.key) && (owned[item.key] ?? 0) > 0) return;
  const cost = dynamicCost(item);
    if (!canAfford(cost)) return;
    payCost(cost);
    // Log purchase
    const costStr = [
      cost.sun ? `${cost.sun} ☀️` : null,
      cost.water ? `${cost.water} 💧` : null,
      cost.wind ? `${cost.wind} 🌬️` : null,
      cost.coins ? `${cost.coins} 💰` : null,
    ].filter(Boolean).join(" + ") || "—";
  pushLog({ type: 'purchase', icon: item.icon, title: `Zakupiono: ${item.name}`, description: `Koszt: ${costStr}` });
    if (item.key === "coal" || item.key === "pellet" || item.key === "gas") { setPendingPlacement(item); return; }
    setOwned(o => ({ ...o, [item.key]: (o[item.key] ?? 0) + 1 }));
    // E-Charger i efekty przeniesione na moment umieszczenia na mapie
    setPendingPlacement(item);
  };

  // Placement
  const placeOnTile = (tile: Tile) => {
    if (!pendingPlacement) return;

    const isHouse = houseUpgradeKeys.includes(pendingPlacement.key);

    // Ograniczenia miejsca
    if (isHouse) {
      if (tile.id !== homeTileId) return; // upgrade domu tylko na domu
      // Dla 'coal' wymagaj pustego domu (start gry)
      if (pendingPlacement.key === 'coal') {
        const home = tiles.find(t => t.id === homeTileId);
        if (home?.entity) return;
      }
    } else {
      // inne obiekty: nie można nadpisać innego obiektu na polu
      if (!tile.isHome && tile.entity) return;
      // jeśli to pole domu i coś stoi, nie pozwalaj (dom zarezerwowany dla upgrade'ów)
      if (tile.isHome && tiles.find(t => t.id === homeTileId)?.entity) return;
    }

    const instance: EntityInstance = { type: pendingPlacement.key, label: pendingPlacement.name, icon: pendingPlacement.icon };
    // Ustaw/Podmień na kafelku
    setTiles(ts => ts.map(t => t.id === tile.id ? { ...t, entity: instance } : t));

    // Licznik posiadanych
    if (isHouse) {
      setOwned(o => {
        const n: Record<EntityType | 'coal', number> = { ...(o as Record<EntityType | 'coal', number>) };
        houseUpgradeKeys.forEach(k => { n[k] = 0; });
        n[pendingPlacement.key] = 1;
        return n;
      });
  // Pollution: apply delta vs previous house state using helper
      const prevHouse = housePollutionRef.current;
  const nextHouse = housePollutionFor(pendingPlacement.key);
      if (nextHouse !== prevHouse) {
        addPollutionRate(nextHouse - prevHouse);
        housePollutionRef.current = nextHouse;
      }

      // Additional progression effects (kept from earlier design)
      if (pendingPlacement.key === 'pellet') {
        setRenewablesUnlocked(true);
        // Kickstart sustainable progression: ensure decent passive income for renewables
        setBaseRates(r => ({
          ...r,
          sun: Math.max(r.sun, 0.2),   // ~1 every 5s on average (day/night/weather considered)
          wind: Math.max(r.wind, 0.15),
          water: Math.max(r.water, 0.15),
          coins: Math.max(r.coins, 0.05) // do not nerf coins
        }));
        // Starter pack to avoid deadlock to gas stage
        setResources(res => ({ ...res, sun: res.sun + 5, water: res.water + 5, wind: res.wind + 5 }));
      } else if (pendingPlacement.key === 'gas') {
        // Keep coin rate unchanged (previously capped down); sustainability over nerf
      }
    } else {
      // Additional rule: forests can be planted only on the perimeter ring
      if (pendingPlacement.key === 'forest') {
        const onPerimeter = tile.x === 0 || tile.y === 0 || tile.x === SIZE - 1 || tile.y === SIZE - 1;
        if (!onPerimeter) return;
      }
      setOwned(o => ({ ...o, [pendingPlacement.key]: (o[pendingPlacement.key] ?? 0) + 1 }));
      if (pendingPlacement.key === 'echarger') setHasECharger(true);
  if (pendingPlacement.key === 'forest') addPollutionRate(-0.5);
      pendingPlacement.onPurchaseEffects?.(effectsCtx);
    }

    pushLog({ type: 'placement', icon: instance.icon, title: `Ustawiono: ${instance.label}`, description: `Kafelek: ${tile.id}` });
    setPendingPlacement(null); setLastPlacedKey(tile.id);
  };

  useEffect(() => {
    if (!lastPlacedKey) return;
    const t = setTimeout(() => setLastPlacedKey(null), 400);
    return () => clearTimeout(t);
  }, [lastPlacedKey]);

  // --- UI helpers ---
  const fmt = (n: number) => {
    if (n === 0) return "0";
    if (Math.abs(n) < 0.01) return n.toFixed(3);
    if (Math.abs(n) < 0.1) return n.toFixed(2);
    return n % 1 === 0 ? n.toString() : n.toFixed(1);
  };
  const rateText = (k: ResKey) => `+${fmt(effectiveRates[k])}/s`;
  const isNearZeroRate = (k: ResKey) => Math.abs(effectiveRates[k]) < 1e-4;

  // Tooltip for pollution pill: breakdown of sources and total rate
  const pollutionTooltip = useMemo(() => {
    const home = tiles.find(t => t.isHome);
    const houseType = home?.entity?.type as EntityType | undefined;
    const forests = tiles.filter(t => t.entity?.type === 'forest').length;
    const house = housePollutionFor(houseType);
    const forest = -0.5 * forests;
    const total = pollutionRate;
  const nameMap: Partial<Record<EntityType, string>> = {
      coal: 'Kocioł żeliwny', pellet: 'Kocioł stalowy', gas: 'Kocioł gazowy Triola',
      parola1965: 'Parola 1965', stainless1972: 'Stal nierdzewna 1972', heatpump1978: 'Pompa ciepła 1978',
      vitola1978: 'Vitola 1978', vitodens1989: 'Vitodens 1989', heatpump: 'Vitocal'
  };
  const hk = (houseType ?? undefined) as EntityType | undefined;
  const houseName = (hk ? nameMap[hk] : undefined) || '—';
    const fmtSign = (n: number) => `${n >= 0 ? '+' : ''}${fmt(n)}/s`;
    return `Dom (${houseName}): ${fmtSign(house)}\nLasy (${forests}): ${fmtSign(forest)}\nŁącznie: ${fmtSign(total)}`;
  }, [tiles, pollutionRate]);

  // Tooltip for season pill
  const seasonTooltip = useMemo(() => {
    const map: Record<SeasonType, { name: string; icon: string; eff: string }> = {
      spring: { name: 'Wiosna', icon: '🌸', eff: '💧 x1.3, smog −0.01/s' },
      summer: { name: 'Lato', icon: '☀️', eff: '☀️ x1.3, smog −0.02/s' },
      autumn: { name: 'Jesień', icon: '🍂', eff: '🌧️/🌬️ x1.2, smog ±0' },
      winter: { name: 'Zima', icon: '❄️', eff: '☀️ x0.7, smog +0.05/s' },
    };
    const s = map[season.type];
    return `${s.icon} ${s.name}: ${s.eff}`;
  }, [season.type]);

  // --- styles ---
  const pill: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, borderRadius: 14, background: "rgba(255,255,255,0.7)", padding: "6px 12px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" };
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
  zIndex: 200
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
    // Ścieżka domu (historyczna)
    { key: "first-steps", title: "Rozpalamy dom", description: "Umieść kocioł żeliwny na domu.", completed: false, reward: "+10 ViCoins", accent: "emerald" },
  { key: "eco-choice", title: "Stalowy krok naprzód", description: "Zastąp kocioł żeliwny stalowym (1917–1928).", completed: false, reward: "+20 ViCoins", accent: "emerald" },
    { key: "triola-gas", title: "Triola – wygoda gazu", description: "Ulepsz do kotła gazowego Triola (1957).", completed: false, reward: "+15 ViCoins", accent: "emerald" },
  { key: "parola-1965", title: "Parola 1965", description: "Zainstaluj kocioł olejowy Parola (1965).", completed: false, reward: "+10 ViCoins", accent: "emerald" },
    { key: "stainless-1972", title: "Nierdzewna rewolucja", description: "Pierwszy kocioł ze stali nierdzewnej (1972).", completed: false, reward: "+15 ViCoins", accent: "emerald" },
  { key: "heatpump-1978", title: "Pierwsza pompa ciepła", description: "Uruchom pompę ciepła (1978).", completed: false, reward: "+15 ViCoins", accent: "emerald" },
    { key: "vitola-1978", title: "Niskotemperaturowy komfort", description: "Kocioł Vitola (1978) – niższa temp. zasilania.", completed: false, reward: "+20 ViCoins", accent: "emerald" },
  { key: "vitodens-1989", title: "Kondensacja po raz pierwszy", description: "Zainstaluj Vitodens (1989).", completed: false, reward: "+20 ViCoins", accent: "emerald" },
    { key: "vitocal-modern", title: "Nowoczesna pompa ciepła", description: "Przejdź na Vitocal (pompa ciepła).", completed: false, reward: "+30 ViCoins", accent: "emerald" },

    // Zielona energia
  { key: "green-investment", title: "Zielona inwestycja", description: "Posadź las.", completed: false, reward: "+30 ViCoins", accent: "emerald" },
    { key: "collector-1972", title: "Kolektor 1972", description: "Zainstaluj pierwszy kolektor słoneczny (1972).", completed: false, reward: "+10 ViCoins", accent: "emerald" },
    { key: "pv-vitovolt", title: "Fotowoltaika na dachu", description: "Zainstaluj PV (Vitovolt).", completed: false, reward: "+20 ViCoins", accent: "emerald" },
    { key: "vitocharge-inverter", title: "Magazyn energii", description: "Dodaj inverter/magazyn (Vitocharge).", completed: false, reward: "+15 ViCoins", accent: "emerald" },
    { key: "grid-connect", title: "Do sieci!", description: "Podłącz instalację do sieci (Grid).", completed: false, reward: "+15 ViCoins", accent: "emerald" },
  { key: "vitovalor-2014", title: "Ogniwo paliwowe", description: "Uruchom Vitovalor (2014).", completed: false, reward: "+25 ViCoins", accent: "emerald" },

    // Komfort i sterowanie
    { key: "floor-heat", title: "Ciepła podłoga", description: "Dodaj ogrzewanie podłogowe.", completed: false, reward: "+10 ViCoins", accent: "emerald" },
    { key: "thermostats-src", title: "Mądre termostaty", description: "Zainstaluj termostaty SRC.", completed: false, reward: "+10 ViCoins", accent: "emerald" },
  { key: "inox-radial", title: "Kondensacja Inox‑Radial", description: "Włącz technologię Inox‑Radial.", completed: false, reward: "+15 ViCoins", accent: "emerald" },

    // Integracja i cele łączone
    { key: "future-home", title: "Dom przyszłości", description: "Miej pompę ciepła + PV + Grid jednocześnie.", completed: false, reward: "+40 ViCoins", accent: "emerald" },
    { key: "zero-smog", title: "Zero smogu", description: "Obniż zanieczyszczenie do 10 lub mniej.", completed: false, reward: "+50 ViCoins", accent: "emerald" },
  ]);

  // Uwaga: świadomie nie utrwalamy stanu misji między restartami gry,
  // aby każda nowa sesja zaczynała z czystą listą (zgodnie z oczekiwaniem).
  useEffect(() => {
    try { localStorage.removeItem('vm_missions'); } catch { /* ignore */ }
  }, []);

  // Sprawdzenia misji: warunki ukończenia
  const missionChecks: Record<string, () => boolean> = useMemo(() => ({
    // Dom/upgrade
    'first-steps': () => placedCounts.coal > 0,
    'eco-choice': () => placedCounts.pellet > 0,
    'triola-gas': () => placedCounts.gas > 0,
    'parola-1965': () => placedCounts.parola1965 > 0,
    'stainless-1972': () => placedCounts.stainless1972 > 0,
    'heatpump-1978': () => placedCounts.heatpump1978 > 0,
    'vitola-1978': () => placedCounts.vitola1978 > 0,
    'vitodens-1989': () => placedCounts.vitodens1989 > 0,
    'vitocal-modern': () => placedCounts.heatpump > 0,
    // Zielona energia
    'green-investment': () => placedCounts.forest > 0,
    'collector-1972': () => placedCounts.collector1972 > 0,
    'pv-vitovolt': () => placedCounts.solar > 0,
    'vitocharge-inverter': () => placedCounts.inverter > 0,
    'grid-connect': () => placedCounts.grid > 0,
    'vitovalor-2014': () => placedCounts.vitovalor2014 > 0,
    // Komfort i sterowanie
    'floor-heat': () => placedCounts.floor > 0,
    'thermostats-src': () => placedCounts.thermostat > 0,
    'inox-radial': () => placedCounts.inoxRadial > 0,
    // Integracja / łączone
    'future-home': () => placedCounts.heatpump > 0 && placedCounts.solar > 0 && placedCounts.grid > 0,
  'zero-smog': () => (placedCounts.heatpump > 0 && placedCounts.inoxRadial > 0 && placedCounts.solar > 0 && placedCounts.grid > 0 && pollution <= 10),
  }), [placedCounts, pollution]);

  // Aplikacja nagród misji: +ViCoins lub -zanieczyszczenia
  const applyMissionReward = useCallback((m: Mission) => {
    const numMatch = m.reward.match(/([+-]?\d+)/);
    const n = numMatch ? parseInt(numMatch[1], 10) : 0;
    if (/ViCoins/i.test(m.reward)) {
      setResources(r => ({ ...r, coins: r.coins + n }));
    } else if (/zanieczyszczenia/i.test(m.reward)) {
      setPollution(p => Math.max(0, p + n)); // n może być ujemne
    }
  }, [setResources, setPollution]);

  // Mission completion logic (placement- and state-based)
  useEffect(() => {
    setMissions(prev => prev.map(m => {
      if (!m.completed) {
        const check = missionChecks[m.key];
        if (check && check()) {
          applyMissionReward(m);
          pushLog({ type: 'mission', icon: '🏅', title: `Ukończono misję: ${m.title}`, description: m.reward });
          return { ...m, completed: true };
        }
      }
      return m;
    }));
  }, [missionChecks, applyMissionReward]);

  // Log start of weather events
  useEffect(() => {
    if (weatherEvent.type === "none") return;
    if (weatherEvent.remaining !== weatherEvent.duration) return; // only when event starts
    const map: Record<WeatherEventType, { icon: string; name: string }> = {
      none: { icon: "", name: "" },
  clouds: { icon: "☁️", name: "Chmury" },
      sunny: { icon: "🌞", name: "Słońce" },
      rain: { icon: "🌧️", name: "Deszcz" },
      wind: { icon: "🌬️", name: "Wiatr" },
  storm: { icon: "⛈️", name: "Burza" },
      frost: { icon: "❄️", name: "Mróz" },
    };
  const meta = map[weatherEvent.type];
  pushLog({ type: 'weather', icon: meta.icon, title: `Zdarzenie pogodowe: ${meta.name}`, description: `Czas trwania: ${weatherEvent.duration}s` });
  }, [weatherEvent]);
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
      {/* Toast stack */}
      {toasts.length > 0 && (
        <div style={{ position: 'fixed', right: 12, top: 12, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 1200 }}>
          {toasts.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0f172a', color: '#e5e7eb', border: '1px solid #334155', borderRadius: 12, padding: '8px 12px', boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
              <span>{t.icon ?? '🔔'}</span>
              <span style={{ fontSize: 13 }}>{t.text}</span>
              <button onClick={() => removeToast(t.id)} title="Zamknij" aria-label="Zamknij"
                style={{ marginLeft: 6, marginRight: -4, background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      {/* top bar */}
  <header style={headerStyle}>
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: "#EA580C" }} />
          <span className="font-extrabold text-base font-sans">Viessmann</span>
        </div>
  <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0, overflowX: 'auto', overflowY: 'visible', paddingBottom: 2 }}>
          <div style={{
            ...pill,
            background: isDay ? "rgba(255,255,255,0.7)" : "#0f172a",
            padding: "6px 24px"
          }}>
            <span style={{ fontSize: 18 }}>☀️</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 12, fontFamily: 'Manrope, system-ui, sans-serif', color: isDay ? "#334155" : "#F1F5F9" }}>Słońce</div>
              <div className="font-semibold font-sans tabular-nums" style={{ color: isDay ? "#111" : "#FBBF24" }}>{fmt(resources.sun)}</div>
              <div className="font-sans tabular-nums" style={{ fontSize: 11, marginTop: 2, color: isNearZeroRate('sun') ? (isDay ? '#94a3b8' : '#64748b') : (isDay ? '#64748b' : '#94a3b8') }}>{rateText('sun')}</div>
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
              <div className="font-sans tabular-nums" style={{ fontSize: 11, marginTop: 2, color: isNearZeroRate('water') ? (isDay ? '#94a3b8' : '#64748b') : (isDay ? '#64748b' : '#94a3b8') }}>{rateText('water')}</div>
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
              <div className="font-sans tabular-nums" style={{ fontSize: 11, marginTop: 2, color: isNearZeroRate('wind') ? (isDay ? '#94a3b8' : '#64748b') : (isDay ? '#64748b' : '#94a3b8') }}>{rateText('wind')}</div>
            </div>
          </div>
          <div style={{
            ...pill,
            background: isDay ? "rgba(255,255,255,0.7)" : "#0f172a",
            padding: "6px 24px"
          }}>
            <span style={{ fontSize: 18 }}>💰</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 12, fontFamily: 'Manrope, system-ui, sans-serif', color: isDay ? "#334155" : "#F1F5F9" }}>
                <span>ViCoins</span>
                {ecoBonusMultiplier > 1 && (
                  <span
                    title={`Bonus czystego powietrza +${Math.round((ecoBonusMultiplier - 1) * 100)}%`}
                    aria-label={`Bonus czystego powietrza +${Math.round((ecoBonusMultiplier - 1) * 100)}%`}
                    style={{
                      fontWeight: 800,
                      fontSize: 11,
                      borderRadius: 999,
                      padding: '1px 6px',
                      background: isDay ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.2)',
                      color: isDay ? '#059669' : '#34d399',
                      lineHeight: 1.6
                    }}
                  >
                    +{Math.round((ecoBonusMultiplier - 1) * 100)}% 💰
                  </span>
                )}
              </div>
              <div className="font-semibold font-sans tabular-nums" style={{ color: isDay ? "#111" : "#FDE68A" }}>{fmt(resources.coins)}</div>
              <div className="font-sans tabular-nums" style={{ fontSize: 11, marginTop: 2, color: isNearZeroRate('coins') ? (isDay ? '#94a3b8' : '#64748b') : (isDay ? '#64748b' : '#94a3b8') }}>{rateText('coins')}</div>
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
              {weatherEvent.type === "storm" && "⛈️"}
              {weatherEvent.type === "frost" && "❄️"}
              {weatherEvent.type === "none" && "🌤️"}
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: isDay ? "#0ea5e9" : "#bae6fd" }}>
                {weatherEvent.type === "clouds" && "Chmury"}
                {weatherEvent.type === "sunny" && "Słońce"}
                {weatherEvent.type === "rain" && "Deszcz"}
                {weatherEvent.type === "wind" && "Wiatr"}
                {weatherEvent.type === "storm" && "Burza"}
                {weatherEvent.type === "frost" && "Mróz"}
                {weatherEvent.type === "none" && "Brak wydarzenia"}
              </div>
              <div style={{ fontSize: 13, color: isDay ? "#334155" : "#e0f2fe", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {weatherEvent.type === "clouds" && "Brak produkcji ☀️"}
                {weatherEvent.type === "sunny" && "x2 produkcja ☀️"}
                {weatherEvent.type === "rain" && "x2 produkcja 💧"}
                {weatherEvent.type === "wind" && "x2 produkcja 🌬️, -50% ☀️, -30% 💧"}
                {weatherEvent.type === "storm" && "x3 🌬️, x1.5 💧, ☀️ = 0"}
                {weatherEvent.type === "frost" && "Wszystkie produkcje zatrzymane"}
                {weatherEvent.type === "none" && "Brak efektu specjalnego"}
              </div>
            </div>
            {weatherEvent.type !== "none" && (
              <span style={{ fontSize: 13, fontWeight: 600, marginLeft: 8, color: isDay ? "#0ea5e9" : "#bae6fd" }}>{weatherEvent.remaining}s</span>
            )}
            {/* Weather legend trigger (fixed overlay renders outside header) */}
            <span
              style={{ marginLeft: 10, cursor: 'pointer', position: 'relative', display: 'inline-block' }}
              tabIndex={0}
              onMouseEnter={(e) => {
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setLegendPos({ left: r.left + r.width / 2, top: r.bottom + 8 });
                setLegendOpen(true);
              }}
              onMouseLeave={() => setLegendOpen(false)}
              onFocus={(e) => {
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setLegendPos({ left: r.left + r.width / 2, top: r.bottom + 8 });
                setLegendOpen(true);
              }}
              onBlur={() => setLegendOpen(false)}
            >
              <span style={{ fontSize: 17, color: isDay ? '#0ea5e9' : '#bae6fd', fontWeight: 700, verticalAlign: 'middle' }}>ℹ️</span>
            </span>
          </div>
          <div style={{
            ...pill,
            background: isDay ? "rgba(255,255,255,0.7)" : "#0f172a",
            padding: "6px 24px"
          }}
          onMouseEnter={(e) => {
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setPollTipPos({ left: r.left + r.width / 2, top: r.bottom + 8 });
            setPollTipOpen(true);
          }}
          onMouseLeave={() => setPollTipOpen(false)}
          onFocus={(e) => {
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setPollTipPos({ left: r.left + r.width / 2, top: r.bottom + 8 });
            setPollTipOpen(true);
          }}
          onBlur={() => setPollTipOpen(false)}
          >
            <span style={{ fontSize: 18 }}>🏭</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 12, fontFamily: 'Manrope, system-ui, sans-serif', color: isDay ? "#334155" : "#F1F5F9" }}>Zanieczyszczenie</div>
              <div className="font-semibold font-sans tabular-nums" style={{ color: isDay ? "#111" : "#FCA5A5" }}>{Math.round(pollution)}</div>
              <div className="font-sans tabular-nums" style={{ fontSize: 11, marginTop: 2, color: pollutionRate < 0 ? '#059669' : '#ef4444' }}>
                {pollutionRate >= 0 ? '+' : ''}{fmt(pollutionRate)}/s
              </div>
              {smogMultiplier < 1 && (
                <div style={{ fontSize: 11, marginTop: 2, color: isDay ? '#64748b' : '#94a3b8' }}>
                  Produkcja −{Math.round((1 - smogMultiplier) * 100)}%
                </div>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }} className="text-base font-medium font-sans">
          <span className="font-medium font-sans">{isDay ? "☀️ Dzień" : "🌙 Noc"}</span>
          <div style={{ width: 120, height: 4, borderRadius: 4, background: "#e5e7eb", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${phasePct}%`, background: "#111" }} />
          </div>
        </div>

        {/* Season pill */}
        <div
          style={{
            ...pill,
            background: isDay ? "rgba(255,255,255,0.7)" : "#0f172a",
            padding: "6px 16px",
          }}
          onMouseEnter={(e) => {
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setSeasonTipPos({ left: r.left + r.width / 2, top: r.bottom + 8 });
            setSeasonTipOpen(true);
          }}
          onMouseLeave={() => setSeasonTipOpen(false)}
          onFocus={(e) => {
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setSeasonTipPos({ left: r.left + r.width / 2, top: r.bottom + 8 });
            setSeasonTipOpen(true);
          }}
          onBlur={() => setSeasonTipOpen(false)}
        >
          <span style={{ fontSize: 16 }}>{season.type === 'spring' ? '🌸' : season.type === 'summer' ? '☀️' : season.type === 'autumn' ? '🍂' : '❄️'}</span>
          <span style={{ fontWeight: 600, fontSize: 14 }}>
            {season.type === 'spring' && 'Wiosna'}
            {season.type === 'summer' && 'Lato'}
            {season.type === 'autumn' && 'Jesień'}
            {season.type === 'winter' && 'Zima'}
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, marginLeft: 8, color: isDay ? "#0ea5e9" : "#bae6fd" }}>{season.remaining}s</span>
        </div>

        {/* Profile Menu */}
        <div style={{ position: "relative" }}>
          <div 
            style={{
              ...pill,
              background: isDay ? "rgba(255,255,255,0.7)" : "#0f172a",
              padding: "6px 16px",
              cursor: "pointer",
              border: showProfileMenu ? "1px solid #0ea5e9" : "1px solid transparent",
              transition: "all 0.2s ease"
            }}
            onClick={() => setShowProfileMenu(!showProfileMenu)}
          >
            <span style={{ fontSize: 16 }}>👤</span>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Mój profil</span>
          </div>
          {(hasNewAchievements || hasNewLog) && (
            <span
              aria-label="nowe"
              title="Nowe"
              style={{
                position: 'absolute',
                top: -4,
                right: -4,
                width: 10,
                height: 10,
                background: '#ef4444',
                borderRadius: 999,
                border: `2px solid ${isDay ? 'rgba(255,255,255,0.7)' : '#0f172a'}`,
                pointerEvents: 'none'
              }}
            />
          )}

          {/* Profile Dropdown */}
          {showProfileMenu && (
            <div style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              background: isDay ? "#ffffff" : "#0f172a",
              color: isDay ? "#0f172a" : "#e5e7eb",
              borderRadius: 8,
              boxShadow: isDay ? "0 4px 12px rgba(0,0,0,0.15)" : "0 8px 20px rgba(0,0,0,0.35)",
              border: isDay ? "1px solid rgba(0,0,0,0.1)" : "1px solid #334155",
              minWidth: 180,
              zIndex: 100
            }}>
              <div 
                style={{ 
                  padding: "12px 16px", 
                  cursor: "pointer", 
                  borderRadius: "8px 8px 0 0",
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  color: isDay ? '#0f172a' : '#e5e7eb'
                }}
                onClick={() => {
                  setShowAchievements(true);
                  setShowProfileMenu(false);
                  const now = Date.now();
                  setLastSeenAchievements(now);
                  try { localStorage.setItem('vm_seen_ach', String(now)); } catch { /* ignore */ }
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setShowAchievements(true);
                    setShowProfileMenu(false);
                    const now = Date.now();
                    setLastSeenAchievements(now);
                    try { localStorage.setItem('vm_seen_ach', String(now)); } catch { /* ignore */ }
                  }
                }}
                onMouseEnter={(e) => (e.target as HTMLElement).style.background = isDay ? '#f3f4f6' : '#1f2937'}
                onMouseLeave={(e) => (e.target as HTMLElement).style.background = 'transparent'}
              >
                <span>🏆</span>
                <span>Osiągnięcia</span>
                <span style={{ marginLeft: "auto", fontSize: 12, color: isDay ? "#666" : "#94a3b8" }}>
                  {achievements.filter(a => a.unlocked).length}/{achievements.length}
                </span>
                {hasNewAchievements && (
                  <span aria-label="nowe" title="Nowe" style={{ marginLeft: 8, width: 8, height: 8, background: '#ef4444', borderRadius: 999, display: 'inline-block' }} />
                )}
              </div>
              <div
                style={{ 
                  padding: "12px 16px", 
                  cursor: "pointer",
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  color: isDay ? '#0f172a' : '#e5e7eb'
                }}
                onClick={() => { 
                  setShowLog(true); 
                  setShowProfileMenu(false); 
                  const now = Date.now();
                  setLastSeenLog(now);
                  try { localStorage.setItem('vm_seen_log', String(now)); } catch { /* ignore */ }
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setShowLog(true);
                    setShowProfileMenu(false);
                    const now = Date.now();
                    setLastSeenLog(now);
                    try { localStorage.setItem('vm_seen_log', String(now)); } catch { /* ignore */ }
                  }
                }}
                onMouseEnter={(e) => (e.target as HTMLElement).style.background = isDay ? '#f3f4f6' : '#1f2937'}
                onMouseLeave={(e) => (e.target as HTMLElement).style.background = 'transparent'}
              >
                <span>📝</span>
                <span>Dziennik</span>
                <span style={{ marginLeft: "auto", fontSize: 12, color: isDay ? "#666" : "#94a3b8" }}>
                  {log.length}
                </span>
                {hasNewLog && (
                  <span aria-label="nowe" title="Nowe" style={{ marginLeft: 8, width: 8, height: 8, background: '#ef4444', borderRadius: 999, display: 'inline-block' }} />
                )}
              </div>
              

              {/* Divider */}
              <div style={{ height: 1, background: isDay ? '#e5e7eb' : '#334155', margin: '6px 0' }} />

              {/* Save actions */}
              <div
                style={{ padding: '10px 16px', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, color: isDay ? '#0f172a' : '#e5e7eb' }}
                onClick={() => { exportSave(); setShowProfileMenu(false); }}
                onMouseEnter={(e) => (e.target as HTMLElement).style.background = isDay ? '#f3f4f6' : '#1f2937'}
                onMouseLeave={(e) => (e.target as HTMLElement).style.background = 'transparent'}
              >
                <span>⬇️</span>
                <span>Zapisz grę</span>
              </div>
              <div
                style={{ padding: '10px 16px', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, color: isDay ? '#0f172a' : '#e5e7eb' }}
                onClick={() => { importInputRef.current?.click(); setShowProfileMenu(false); }}
                onMouseEnter={(e) => (e.target as HTMLElement).style.background = isDay ? '#f3f4f6' : '#1f2937'}
                onMouseLeave={(e) => (e.target as HTMLElement).style.background = 'transparent'}
              >
                <span>⬆️</span>
                <span>Wczytaj grę</span>
              </div>
              {/* Hidden file input for import */}
              <input ref={importInputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={onImportFileChange} />

              <div
                style={{ padding: '10px 16px', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444' }}
                onClick={() => { resetGame(); }}
                onMouseEnter={(e) => (e.target as HTMLElement).style.background = isDay ? '#fee2e2' : '#7f1d1d'}
                onMouseLeave={(e) => (e.target as HTMLElement).style.background = 'transparent'}
              >
                <span>🗑️</span>
                <span>Nowa gra</span>
              </div>
            </div>
          )}
        </div>
      </header>
      {/* Season tooltip (custom) */}
      {seasonTipOpen && (
        <div
          style={{
            position: 'fixed',
            left: seasonTipPos.left,
            top: seasonTipPos.top,
            transform: 'translateX(-50%)',
            minWidth: 200,
            maxWidth: '92vw',
            background: isDay ? '#ffffff' : '#0f172a',
            color: isDay ? '#0f172a' : '#e5e7eb',
            border: isDay ? '1px solid #e5e7eb' : '1px solid #334155',
            borderRadius: 10,
            boxShadow: isDay ? '0 8px 24px rgba(0,0,0,0.12)' : '0 8px 24px rgba(0,0,0,0.35)',
            padding: '10px 12px',
            fontSize: 13,
            zIndex: 1200,
            pointerEvents: 'none',
          }}
          aria-hidden
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, marginBottom: 4 }}>
            <span>{season.type === 'spring' ? '🌸' : season.type === 'summer' ? '☀️' : season.type === 'autumn' ? '🍂' : '❄️'}</span>
            <span>
              {season.type === 'spring' && 'Wiosna'}
              {season.type === 'summer' && 'Lato'}
              {season.type === 'autumn' && 'Jesień'}
              {season.type === 'winter' && 'Zima'}
            </span>
          </div>
          <div style={{ color: isDay ? '#334155' : '#94a3b8', marginBottom: 6 }}>{seasonTooltip}</div>
          <div style={{ fontSize: 12, color: isDay ? '#64748b' : '#94a3b8' }}>Pozostało: {season.remaining}s</div>
        </div>
      )}
      {/* Pollution tooltip (custom) */}
      {pollTipOpen && (
        <div
          style={{
            position: 'fixed',
            left: pollTipPos.left,
            top: pollTipPos.top,
            transform: 'translateX(-50%)',
            minWidth: 220,
            maxWidth: '92vw',
            background: isDay ? '#ffffff' : '#0f172a',
            color: isDay ? '#0f172a' : '#e5e7eb',
            border: isDay ? '1px solid #e5e7eb' : '1px solid #334155',
            borderRadius: 10,
            boxShadow: isDay ? '0 8px 24px rgba(0,0,0,0.12)' : '0 8px 24px rgba(0,0,0,0.35)',
            padding: '10px 12px',
            fontSize: 13,
            zIndex: 1200,
            pointerEvents: 'none',
            whiteSpace: 'pre-line',
          }}
          aria-hidden
        >
          {pollutionTooltip.split('\n').map((line, i) => (
            <div key={i} style={{ color: i === 2 ? (pollutionRate < 0 ? '#059669' : '#ef4444') : (isDay ? '#334155' : '#94a3b8'), fontWeight: i === 2 ? 700 : 500 }}>
              {line}
            </div>
          ))}
        </div>
      )}
  {/* Fixed weather legend overlay (outside scroll containers) */}
      {legendOpen && (
        <div
          style={{
            position: 'fixed',
            left: legendPos.left,
            top: legendPos.top,
            transform: 'translateX(-50%)',
            minWidth: 220,
            maxWidth: '90vw',
            background: isDay ? '#fff' : '#1e293b',
            color: isDay ? '#0f172a' : '#e0f2fe',
            border: '1px solid #bae6fd',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(30,64,175,0.18)',
            padding: '14px 18px',
            fontSize: 13,
            zIndex: 1200,
            pointerEvents: 'none',
          }}
          aria-hidden
        >
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
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexDirection: 'column', alignItems: 'flex-start' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span>⛈️</span><span style={{ fontWeight: 700 }}>Burza</span></span>
            <span style={{ color: '#60a5fa', fontSize: 12, marginLeft: 28 }}>x3 🌬️, x1.5 💧, ☀️ = 0 (20s)</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexDirection: 'column', alignItems: 'flex-start' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span>❄️</span><span style={{ fontWeight: 700 }}>Mróz</span></span>
            <span style={{ color: '#60a5fa', fontSize: 12, marginLeft: 28 }}>wszystkie produkcje zatrzymane na 30s</span>
          </div>
        </div>
      )}

      {/* Missions Modal */}
      {showMissions && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={(e) => { if (e.currentTarget === e.target) setShowMissions(false); }}
        >
          <div style={{ width: 520, maxWidth: '92vw', background: isDay ? '#fff' : '#0f172a', color: isDay ? '#0f172a' : '#e5e7eb', borderRadius: 12, padding: 20, boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 18, flex: 1 }}>Misje</div>
              <button onClick={() => setShowMissions(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: isDay ? '#0f172a' : '#e5e7eb' }}>✖</button>
            </div>
            <div style={{ marginBottom: 12, fontSize: 13, color: isDay ? '#475569' : '#94a3b8' }}>
              Postęp: {missions.filter(m => m.completed).length}/{missions.length}
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {missions.map(m => (
                <div key={m.key} style={{ padding: 12, borderRadius: 10, border: isDay ? '1px solid #e5e7eb' : '1px solid #334155', background: isDay ? '#ffffff' : '#111827', opacity: m.completed ? 0.85 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{m.accent === 'emerald' ? '✅' : '🎯'}</span>
                    <div style={{ fontWeight: 700 }}>{m.title}</div>
                    {m.completed && <span style={{ marginLeft: 'auto', color: '#10b981', fontSize: 12, fontWeight: 700 }}>ukończono</span>}
                  </div>
                  <div style={{ fontSize: 12, color: isDay ? '#475569' : '#94a3b8' }}>{m.description}</div>
                  {/* Progress bar */}
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {(() => { const p = missionProgress[m.key]; return (
                      <>
                        <div style={{ flex: 1, height: 6, background: isDay ? '#e5e7eb' : '#334155', borderRadius: 6, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(100, Math.round(((p?.value ?? 0) / Math.max(1, p?.max ?? 1)) * 100))}%`, background: '#10b981' }} />
                        </div>
                        <span style={{ fontSize: 12, color: isDay ? '#64748b' : '#94a3b8', minWidth: 64, textAlign: 'right' }}>{p?.label || ''}</span>
                      </>
                    ); })()}
                  </div>
                  <div style={{ fontSize: 12, marginTop: 6 }}>
                    Nagroda: <span style={{ fontWeight: 700 }}>{m.reward}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* body */}
      <main style={gridWrap}>
        {/* shop */}
        <aside style={card}>
          {/* Home device info card */}
          {(() => {
            const home = tiles.find(t => t.id === homeTileId);
            const ent = home?.entity && (houseUpgradeKeys.includes(home.entity.type as EntityType) ? home.entity : null);
            return (
              <div
                style={{
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 16,
                  background: isDay ? '#fff' : '#0b1220',
                  color: isDay ? '#0f172a' : '#e5e7eb',
                  border: isDay ? '1px solid #e5e7eb' : '1px solid #334155',
                  borderLeft: isDay ? '4px solid #f59e0b' : '4px solid #60a5fa',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <span style={{ fontSize: 20 }}>{ent ? ent.icon : '🏠'}</span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span className="font-semibold font-sans" style={{ fontSize: 12, letterSpacing: 0.2, textTransform: 'uppercase', opacity: 0.9 }}>
                    {ent ? 'Na domu:' : 'Brak urządzeń'}
                  </span>
                  <span className="font-medium font-sans" style={{ fontSize: 15 }}>
                    {ent ? ent.label : 'Umieść kocioł na domu, aby rozpocząć.'}
                  </span>
                </div>
              </div>
            );
          })()}
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <button className={`font-semibold font-sans ${shopTab === "devices" ? "bg-neutral-900 text-white" : "bg-neutral-200 text-neutral-900"} rounded-full text-sm px-3 py-1`} style={btn(shopTab === "devices")} onClick={() => setShopTab("devices")}>Urządzenia</button>
            <button className={`font-semibold font-sans ${shopTab === "production" ? "bg-neutral-900 text-white" : "bg-neutral-200 text-neutral-900"} rounded-full text-sm px-3 py-1`} style={btn(shopTab === "production")} onClick={() => setShopTab("production")}>Produkcja</button>
          </div>
          {/* Removed start tooltip text as requested */}
          <div style={{ display: "grid", gap: 8 }}>
            {(shopTab === "devices" ? visibleDevices : visibleProduction).map((item) => {
              const cost = dynamicCost(item);
              const ownedCount = owned[item.key] ?? 0;
              const done = isSinglePurchase(item.key) && ownedCount > 0;
              const afford = !done && canAfford(cost);
              const isPending = pendingPlacement?.key === item.key;
              const missingParts: string[] = [];
              if (!done) {
                if ((cost.sun ?? 0) > resources.sun) missingParts.push(`${Math.max(0, (cost.sun ?? 0) - resources.sun)} ☀️`);
                if ((cost.water ?? 0) > resources.water) missingParts.push(`${Math.max(0, (cost.water ?? 0) - resources.water)} 💧`);
                if ((cost.wind ?? 0) > resources.wind) missingParts.push(`${Math.max(0, (cost.wind ?? 0) - resources.wind)} 🌬️`);
                if ((cost.coins ?? 0) > resources.coins) missingParts.push(`${Math.max(0, (cost.coins ?? 0) - resources.coins)} 💰`);
              }
              return (
                <div
                  key={item.key}
                  style={{
                    ...card,
                    padding: 12,
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 120,
                    background: isDay ? (card.background ?? "rgba(255,255,255,0.7)") : "#0f172a",
                    transition: "transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease",
                    border: isDay ? "1px solid rgba(0,0,0,0.06)" : "1px solid #1f2937",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                    cursor: done ? "default" : "pointer",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow = isDay ? "0 4px 12px rgba(0,0,0,0.08)" : "0 4px 12px rgba(0,0,0,0.28)";
                    (e.currentTarget as HTMLDivElement).style.transform = "translateY(-0.5px)";
                    (e.currentTarget as HTMLDivElement).style.borderColor = isDay ? "#e5e7eb" : "#2b3647";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
                    (e.currentTarget as HTMLDivElement).style.transform = "none";
                    (e.currentTarget as HTMLDivElement).style.borderColor = isDay ? "rgba(0,0,0,0.06)" : "#1f2937";
                  }}
                  onMouseDown={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = "translateY(0) scale(0.998)";
                  }}
                  onMouseUp={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = "translateY(-0.5px)";
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
            <span className="text-sm font-semibold font-sans tabular-nums" style={{ fontSize: 12 }}>
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
            title={!afford && missingParts.length ? `Brak zasobów: ${missingParts.join(" + ")}` : undefined}
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
          </div>
          <IsoGrid
            tiles={tiles}
            homeTileId={homeTileId}
            onTileClick={placeOnTile}
            pendingItem={pendingPlacement ? { key: pendingPlacement.key, name: pendingPlacement.name, icon: pendingPlacement.icon } : null}
            lastPlacedKey={lastPlacedKey}
            isPlaceable={(t) => {
              if (!pendingPlacement) return false;
              const isHouse = houseUpgradeKeys.includes(pendingPlacement.key);
              if (isHouse) {
                if (t.id !== homeTileId) return false;
                // coal: tylko na pustym domu, inne mogą nadpisać
                if (pendingPlacement.key === 'coal') return !t.entity;
                return true;
              } else {
                if (t.isHome) {
                  const home = tiles.find((x) => x.id === homeTileId);
                  return !!home && !home.entity;
                }
                // forests only on perimeter ring
                if (pendingPlacement.key === 'forest') {
                  const onPerimeter = t.x === 0 || t.y === 0 || t.x === SIZE - 1 || t.y === SIZE - 1;
                  if (!onPerimeter) return false;
                }
                return !t.entity;
              }
            }}
            weatherEvent={weatherEvent}
            isDay={isDay}
          />
          {/* Ekonomia panel removed – header now shows rate info */}
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

      {/* Achievements Popup */}
      {showAchievements && (
        <div
          onClick={(e) => { if (e.currentTarget === e.target) setShowAchievements(false); }}
          style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            background: isDay ? "white" : "#0f172a",
            color: isDay ? "#0f172a" : "#e5e7eb",
            borderRadius: 16,
            padding: 24,
            maxWidth: 600,
            maxHeight: "80vh",
            overflow: "auto",
            margin: 20,
            boxShadow: isDay ? "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" : "0 20px 40px rgba(0,0,0,0.5)",
            border: isDay ? "1px solid #e5e7eb" : "1px solid #334155"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: isDay ? "#0f172a" : "#e5e7eb" }}>🏆 Osiągnięcia</h2>
              <button 
                onClick={() => setShowAchievements(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 24,
                  cursor: "pointer",
                  padding: 4,
                  color: isDay ? "#666" : "#94a3b8"
                }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ display: "grid", gap: 12 }}>
              {achievements.map(achievement => (
                <div 
                  key={achievement.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: 16,
                    borderRadius: 12,
                    background: isDay ? (achievement.unlocked ? "#f0f9ff" : "#f9fafb") : "#111827",
                    border: isDay ? `1px solid ${achievement.unlocked ? "#e0f2fe" : "#e5e7eb"}` : "1px solid #334155",
                    opacity: achievement.unlocked ? 1 : 0.6
                  }}
                >
                  <span style={{ fontSize: 24 }}>{achievement.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      fontWeight: 600, 
                      marginBottom: 4,
                      color: isDay ? (achievement.unlocked ? "#0f172a" : "#6b7280") : (achievement.unlocked ? "#e5e7eb" : "#94a3b8")
                    }}>
                      {achievement.name}
                    </div>
                    <div style={{ 
                      fontSize: 14, 
                      color: isDay ? (achievement.unlocked ? "#64748b" : "#9ca3af") : (achievement.unlocked ? "#94a3b8" : "#94a3b8")
                    }}>
                      {achievement.description}
                    </div>
                    {achievement.id === 'solar-farm' && !achievement.unlocked && (
                      <div style={{ fontSize: 12, color: isDay ? '#6b7280' : '#94a3b8', marginTop: 4 }}>
                        Postęp: {Math.min(placedCounts.solar ?? 0, 3)}/3 paneli
                      </div>
                    )}
                    {achievement.unlocked && achievement.unlockedAt && (
                      <div style={{ 
                        fontSize: 12, 
                        color: "#10b981", 
                        marginTop: 4 
                      }}>
                        Odblokowano: {achievement.unlockedAt.toLocaleString()}
                      </div>
                    )}
                  </div>
                  {achievement.unlocked && (
                    <span style={{ fontSize: 20, color: "#10b981" }}>✓</span>
                  )}
                </div>
              ))}
            </div>
            
            <div style={{ 
              marginTop: 20, 
              padding: 16, 
              background: isDay ? "#f8fafc" : "#111827", 
              borderRadius: 12,
              textAlign: "center",
              border: isDay ? "1px solid #e5e7eb" : "1px solid #334155",
              color: isDay ? "#0f172a" : "#e5e7eb"
            }}>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
                Postęp: {achievements.filter(a => a.unlocked).length}/{achievements.length}
              </div>
              <div style={{ fontSize: 14, color: isDay ? "#64748b" : "#94a3b8" }}>
                {((achievements.filter(a => a.unlocked).length / achievements.length) * 100).toFixed(0)}% ukończono
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Log Popup */}
  {showLog && (
        <div
          onClick={(e) => { if (e.currentTarget === e.target) setShowLog(false); }}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}
        >
          <div style={{
            background: isDay ? "white" : "#0f172a",
            color: isDay ? "#0f172a" : "#e5e7eb",
            borderRadius: 16,
            padding: 24,
            maxWidth: 700,
            width: "min(92vw,700px)",
            maxHeight: "80vh",
            overflow: "auto",
            margin: 20,
            boxShadow: isDay ? "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" : "0 20px 40px rgba(0,0,0,0.5)",
            border: isDay ? "1px solid #e5e7eb" : "1px solid #334155"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: isDay ? "#0f172a" : "#e5e7eb" }}>📝 Dziennik</h2>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  onClick={() => setLog([])}
                  style={{ 
                    background: isDay ? '#f1f5f9' : '#1f2937', 
                    color: isDay ? '#334155' : '#e5e7eb', 
                    border: isDay ? '1px solid #e5e7eb' : '1px solid #334155', 
                    borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 12 
                  }}
                >Wyczyść</button>
                <button 
                  onClick={() => setShowLog(false)}
                  style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', padding: 4, color: isDay ? '#666' : '#94a3b8' }}
                >✕</button>
              </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {([
                { k: 'all', label: 'Wszystko' },
                { k: 'purchase', label: 'Zakupy' },
                { k: 'placement', label: 'Ustawienia' },
                { k: 'mission', label: 'Misje' },
                { k: 'weather', label: 'Pogoda' },
                { k: 'achievement', label: 'Osiągnięcia' },
                { k: 'milestone', label: 'Kamienie milowe' },
              ] as Array<{ k: 'all' | LogType; label: string }>).map(btn => (
                <button key={btn.k}
                  onClick={() => setLogFilter(btn.k)}
                  style={{
                    background: logFilter === btn.k ? (isDay ? '#0f172a' : '#334155') : (isDay ? '#f1f5f9' : '#1f2937'),
                    color: logFilter === btn.k ? (isDay ? '#ffffff' : '#e5e7eb') : (isDay ? '#334155' : '#94a3b8'),
                    border: isDay ? '1px solid #e5e7eb' : '1px solid #334155',
                    borderRadius: 999, padding: '6px 10px', cursor: 'pointer', fontSize: 12
                  }}
                >{btn.label}</button>
              ))}
            </div>

            {log.length === 0 ? (
              <div style={{ color: isDay ? '#6b7280' : '#94a3b8', fontSize: 14 }}>Brak wpisów</div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {(logFilter === 'all' ? log : log.filter(e => (e.type ?? 'other') === logFilter)).map((entry) => (
                  <div key={entry.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 12,
                    background: isDay ? '#f9fafb' : '#111827', border: isDay ? '1px solid #e5e7eb' : '1px solid #334155'
                  }}>
                    <div style={{ fontSize: 18, lineHeight: '18px' }}>{entry.icon ?? '•'}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: isDay ? '#0f172a' : '#e5e7eb', marginBottom: 2 }}>{entry.title}</div>
                      {entry.description && <div style={{ fontSize: 13, color: isDay ? '#475569' : '#94a3b8' }}>{entry.description}</div>}
                    </div>
                    <div style={{ fontSize: 12, color: isDay ? '#64748b' : '#94a3b8', whiteSpace: 'nowrap', marginLeft: 8 }}>
                      {new Date(entry.at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Click outside to close profile menu */}
      {showProfileMenu && (
        <div 
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 50
          }}
          onClick={() => setShowProfileMenu(false)}
        />
      )}
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
  pendingItem: { key: string; name: string; icon: string } | null;
  lastPlacedKey: string | null;
  isPlaceable?: (t: IsoTileType) => boolean;
  weatherEvent: WeatherEvent;
  isDay: boolean;
}) {
  const [hoverInfo, setHoverInfo] = useState<{ tile: IsoTileType; left: number; top: number; placeable: boolean } | null>(null);
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
          {weatherEvent.type === "storm" && (
            <span style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
              {/* Lightning flashes */}
              <span style={{ position: 'absolute', left: '10%', top: 8, fontSize: 32, opacity: 0.8, animation: 'storm-flash 2.2s ease-in-out infinite' }}>⛈️</span>
              <span style={{ position: 'absolute', right: '12%', top: 18, fontSize: 28, opacity: 0.6, animation: 'storm-flash2 2.8s ease-in-out infinite' }}>⛈️</span>
              {/* Strong wind lines */}
              <span style={{ position: 'absolute', left: '15%', top: 52, fontSize: 22, opacity: 0.6, animation: 'wind-move1 1.2s linear infinite' }}>🌬️</span>
              <span style={{ position: 'absolute', left: '45%', top: 36, fontSize: 18, opacity: 0.5, animation: 'wind-move3 0.9s linear infinite' }}>🌬️</span>
              {/* Rain intensifies */}
              <span style={{ position: 'absolute', left: '30%', top: 12, width: 4, height: 18, background: 'linear-gradient(to bottom, #2563eb 90%, transparent)', borderRadius: 2, animation: 'rain-bar 0.8s linear infinite', boxShadow: '0 0 4px 1px #2563eb55' }} />
              <span style={{ position: 'absolute', left: '34%', top: 16, width: 3, height: 14, background: 'linear-gradient(to bottom, #3b82f6 90%, transparent)', borderRadius: 2, animation: 'rain-bar2 0.9s linear infinite', boxShadow: '0 0 3px 1px #3b82f655' }} />
              <span style={{ position: 'absolute', left: '38%', top: 10, width: 2, height: 12, background: 'linear-gradient(to bottom, #60a5fa 90%, transparent)', borderRadius: 2, animation: 'rain-bar3 1.1s linear infinite', boxShadow: '0 0 2px 1px #60a5fa55' }} />
              <style>{`
                @keyframes storm-flash { 0%{opacity:0.5;} 10%{opacity:1;} 20%{opacity:0.4;} 100%{opacity:0.5;} }
                @keyframes storm-flash2 { 0%{opacity:0.3;} 12%{opacity:0.9;} 24%{opacity:0.3;} 100%{opacity:0.3;} }
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
  const isForestPending = pendingItem?.key === 'forest';
  const onPerimeter = t.x === 0 || t.y === 0 || t.x === size - 1 || t.y === size - 1;
  // Allowed = only empty perimeter tiles while planting forest
  const highlightAllowed = !!pendingItem && isForestPending && onPerimeter && !t.entity;
  // Dim non-perimeter area while forest is pending (visual guidance)
  const dimNonPerimeter = !!pendingItem && isForestPending && !onPerimeter;
        return (
          <IsoTile
            key={t.id}
            tile={t}
            left={left}
            top={top}
            w={tileW}
            h={tileH}
            onClick={() => onTileClick(t)}
            onHoverChange={(h) => {
              if (h) setHoverInfo({ tile: t, left, top, placeable });
              else if (hoverInfo?.tile.id === t.id) setHoverInfo(null);
            }}
            isHome={t.id === homeTileId}
            pendingItem={pendingItem}
            placeable={placeable}
            isNewlyPlaced={lastPlacedKey === t.id}
            highlightAllowed={highlightAllowed}
            dimDisallowed={dimNonPerimeter}
            isDay={isDay}
          />
        );
      })}
      {/* Hover card */}
      {hoverInfo && (
        <div
          style={{
            position: 'absolute',
            left: hoverInfo.left + tileW / 2,
            top: hoverInfo.top - 8,
            transform: 'translate(-50%,-100%)',
            background: isDay ? '#ffffff' : '#0f172a',
            color: isDay ? '#0f172a' : '#e5e7eb',
            border: isDay ? '1px solid #e5e7eb' : '1px solid #334155',
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 12,
            boxShadow: isDay ? '0 6px 16px rgba(0,0,0,0.08)' : '0 8px 20px rgba(0,0,0,0.35)',
            pointerEvents: 'none',
            zIndex: 4,
            whiteSpace: 'nowrap'
          }}
        >
          {(() => {
            const t = hoverInfo.tile;
            const icon = t.isHome ? '🏠' : t.entity ? t.entity.icon : pendingItem ? pendingItem.icon : '⬜';
            const text = t.isHome
              ? (t.entity ? `Dom: ${t.entity.label}` : 'Dom')
              : t.entity
              ? t.entity.label
              : pendingItem
              ? `${hoverInfo.placeable ? 'Postaw: ' : 'Nie można tutaj: '}${pendingItem.name}`
              : 'Pusty kafelek';
            return (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14 }}>{icon}</span>
                <span className="font-medium font-sans">{text}</span>
              </span>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function IsoTile({
  tile, onClick, isHome, pendingItem, left, top, w, h, placeable, isNewlyPlaced, onHoverChange, highlightAllowed, dimDisallowed, isDay,
}: {
  tile: { id: string; entity?: { type: string; icon: string; label: string } | null };
  onClick: () => void;
  isHome: boolean;
  pendingItem: { name: string; icon: string } | null;
  left: number; top: number; w: number; h: number;
  placeable: boolean;
  isNewlyPlaced: boolean;
  onHoverChange?: (hovered: boolean) => void;
  highlightAllowed?: boolean;
  dimDisallowed?: boolean;
  isDay?: boolean;
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
  const baseStroke = pendingItem ? (placeable ? 'rgba(59,130,246,0.35)' : 'rgba(0,0,0,0.12)') : 'rgba(0,0,0,0.15)';
  const stroke = hovered ? (placeable ? "#38BDF8" : "#FB7185") : baseStroke;
  // Subtle dimming for disallowed area when guiding forest placement
  const dimOverlay = dimDisallowed ? (isDay ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)') : 'transparent';
  const fill = pressed ? downFill : hovered ? hoverFill : baseFill;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => { setHovered(true); onHoverChange?.(true); }}
      onMouseLeave={() => { setHovered(false); setPressed(false); onHoverChange?.(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
  title={isHome ? (tile.entity ? `Dom: ${tile.entity.label}` : "Dom") : tile.entity ? tile.entity.label : pendingItem ? `Postaw: ${pendingItem.name}` : "Pusty kafelek"}
      style={{
        position: "absolute", left, top, width: w, height: h,
        WebkitClipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)",
        clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)",
        border: "none", padding: 0, background: "transparent", cursor: placeable ? "pointer" : "not-allowed",
      }}
    >
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        style={{
          filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.1))",
          pointerEvents: "none",
        }}
      >
        <polygon points={`${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`} fill={fill} stroke={stroke} strokeWidth={1} shapeRendering="crispEdges" />
        {/* Dim non-perimeter tiles during forest placement */}
        {dimDisallowed ? (
          <polygon
            points={`${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`}
            fill={dimOverlay}
            stroke="transparent"
            shapeRendering="crispEdges"
          />
        ) : null}
        {highlightAllowed ? (
          <polygon
            points={`${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`}
            fill={isDay ? "rgba(16,185,129,0.18)" : "rgba(16,185,129,0.22)"}
            stroke={isDay ? "rgba(16,185,129,0.5)" : "rgba(16,185,129,0.6)"}
            strokeWidth={1}
            shapeRendering="crispEdges"
          />
        ) : null}
        {highlightAllowed && hovered ? (
          <polygon
            points={`${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`}
            fill="none"
            stroke={isDay ? "rgba(16,185,129,0.95)" : "rgba(16,185,129,1)"}
            strokeWidth={2}
            shapeRendering="crispEdges"
          />
        ) : null}
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
      {/* Leaf burst when a forest is placed */}
      {isNewlyPlaced && tile.entity?.type === 'forest' ? (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%,-50%)",
            pointerEvents: "none",
          }}
        >
          <span style={{ position: 'absolute', left: -2, top: -8, animation: 'leaf-burst-1 500ms ease-out forwards' }}>🍃</span>
          <span style={{ position: 'absolute', left: 6, top: -6, animation: 'leaf-burst-2 520ms ease-out forwards' }}>🌿</span>
          <span style={{ position: 'absolute', left: 0, top: 0, animation: 'leaf-burst-3 540ms ease-out forwards' }}>🍃</span>
        </div>
      ) : null}

      {/* keyframes */}
      <style>{`
        @keyframes pulse{0%{opacity:.35}50%{opacity:.55}100%{opacity:.35}}
        @keyframes leaf-burst-1{0%{transform:translate(0,0) rotate(0deg);opacity:1}100%{transform:translate(-10px,-14px) rotate(-18deg);opacity:0}}
        @keyframes leaf-burst-2{0%{transform:translate(0,0) rotate(0deg);opacity:1}100%{transform:translate(12px,-12px) rotate(22deg);opacity:0}}
        @keyframes leaf-burst-3{0%{transform:translate(0,0) rotate(0deg);opacity:1}100%{transform:translate(0,10px) rotate(12deg);opacity:0}}
      `}</style>
    </button>
  );
}
