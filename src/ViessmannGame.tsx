import React, { useCallback, useEffect, useMemo, useRef, useState, useImperativeHandle } from "react";
import { canAfford as canAffordHelper, discountedCost as discountedCostHelper, dynamicCost as dynamicCostHelper } from './lib/economy';
import { clamp as clampHelper, seasonPollutionFor as seasonPollutionForHelper, housePollutionFor as housePollutionForHelper } from './lib/pollution';
import { getSampleEvents } from './lib/story';
import type { StoryEvent, StoryApi, StoryContext, StoryChoice } from './lib/story';
import StoryModal from './components/StoryModal';
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
  | "vitovalor2014"
  | "lab"; // Laboratorium R&D – powtarzalny budynek podnoszący produkcję
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
  "lab",
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
  { key: "thermostat", name: "Termostaty SRC", description: "Inteligentna regulacja – więcej zasobów.", icon: "🌡️", cost: { sun: 5, water: 5, wind: 5 }, requires: ["vitodens1989"], onPurchaseEffects: (ctx) => {
    // Subtle boost to passive generation as a benefit of smart control
    ctx.addRate('sun', 0.05);
    ctx.addRate('water', 0.05);
    ctx.addRate('wind', 0.05);
  } },
  { key: "solar", name: "Fotowoltaika (Vitovolt)", description: "Więcej ☀️.", icon: "🔆", cost: { sun: 20, wind: 10 }, requires: ["heatpump"] },
  { key: "inverter", name: "Inverter / magazyn (Vitocharge)", description: "Lepsza monetyzacja – więcej 💰.", icon: "🔶", cost: { sun: 20, water: 10, wind: 10 }, requires: ["heatpump"] },
  { key: "grid", name: "Grid", description: "Wymiana energii – więcej 💰.", icon: "⚡", cost: { sun: 10, water: 10, wind: 20 }, requires: ["heatpump"] },
  { key: "vitovalor2014", name: "Vitovalor (2014)", description: "Ogniwo paliwowe – silnie redukuje zanieczyszczenie.", icon: "🧫", cost: { sun: 35, water: 20, wind: 20 }, requires: ["heatpump"] },
  { key: "echarger", name: "E-Charger", description: "+5 💰/min.", icon: "🔌", cost: { wind: 20, water: 20 }, requires: ["heatpump"] },
  { key: "lab", name: "Laboratorium R&D", description: "Trwale zwiększa produkcję zasobów (+0.02 ☀️/💧/🌬️, +0.01 💰). Tylko jedno – ale bardzo drogie.", icon: "🧪", cost: { coins: 500 }, onPurchaseEffects: (ctx) => {
    ctx.addRate('sun', 0.02);
    ctx.addRate('water', 0.02);
    ctx.addRate('wind', 0.02);
    ctx.addRate('coins', 0.01);
  } },
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
  const clamp = clampHelper;
  const addPollutionRate = useCallback((d: number) => setPollutionRate((p) => Math.max(-2, p + d)), []);
  // Helper aliases (must be declared before effects that depend on them)
  const seasonPollutionFor = seasonPollutionForHelper as (t: SeasonType) => number;
  const housePollutionFor = housePollutionForHelper as (k: EntityType | null | undefined) => number;
  // Sezonowy wkład do pollutionRate (delta vs poprzedni sezon)
  const seasonDeltaRef = useRef(0);
  useEffect(() => {
    const next = seasonPollutionFor(season.type);
    const prev = seasonDeltaRef.current;
    if (next !== prev) {
      addPollutionRate(next - prev);
      seasonDeltaRef.current = next;
    }
  }, [season.type, seasonPollutionFor, addPollutionRate]);
  // Dzień/noc
  const DAY_LENGTH = 240; // s
  const DAY_FRACTION = 0.7; // 70% dzień
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(0);
  const isDay = useMemo(() => (elapsed % DAY_LENGTH) < DAY_LENGTH * DAY_FRACTION, [elapsed]);
  // Map view state for external minimap
  const isoRef = useRef<IsoGridHandle | null>(null);
  const [isoView, setIsoView] = useState<IsoView | null>(null);

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
  const coinBonusPct = useMemo(() => Math.max(0, Math.round((ecoBonusMultiplier - 1) * 100)), [ecoBonusMultiplier]);
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
      coal: 0, pellet: 0, gas: 0, floor: 0, thermostat: 0, heatpump: 0, inverter: 0, grid: 0, solar: 0, echarger: 0, forest: 0, lab: 0,
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
  // Story system state
  const [activeStory, setActiveStory] = useState<StoryEvent | null>(null);
  const storyShownRef = useRef<Set<string>>(new Set());
  const storyEventsRef = useRef<ReturnType<typeof getSampleEvents> | null>(null);
  const storyCooldownsRef = useRef<Record<string, number>>({});
  const [storyFlags, setStoryFlags] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('vm_story_flags') || '{}') as Record<string, boolean>; } catch { return {}; }
  });
  useEffect(() => { try { localStorage.setItem('vm_story_flags', JSON.stringify(storyFlags)); } catch { /* ignore */ } }, [storyFlags]);
  const [factions, setFactions] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('vm_factions') || '{}') as Record<string, number>; } catch { return {}; }
  });
  useEffect(() => { try { localStorage.setItem('vm_factions', JSON.stringify(factions)); } catch { /* ignore */ } }, [factions]);
  if (!storyEventsRef.current) storyEventsRef.current = getSampleEvents();
  // Time-limited global discount driven by story/events (separate from priceDiscountPct)
  const [storyDiscountPct, setStoryDiscountPct] = useState(0);
  const [storyDiscountTimer, setStoryDiscountTimer] = useState(0);
  const [storyDiscountLabel, setStoryDiscountLabel] = useState<string | null>(null);
  // Keep TS/ESLint aware that timer is observed (affects UI via pricing even if we don't render it)
  useEffect(() => { /* timer tick observed */ }, [storyDiscountTimer]);
  const [owned, setOwned] = useState<Record<EntityType | "coal", number>>(() => makeOwnedInit());


  const [shopTab, setShopTab] = useState<"devices" | "production">("devices");
  // Multiple-purchase items: allow buying more than one (thermostat joins solar/echarger/forest)
  const isSinglePurchase = (k: EntityType) => !["solar", "echarger", "forest", "thermostat"].includes(k);

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

  // -------- Save system v2 (extends v1 with ecoRepHistory and storyDecisions) --------
  type SaveV1 = {
    v: 1;
    resources: Record<ResKey, number>;
    pollution: number;
    tiles: Array<{ id: string; x: number; y: number; isHome?: boolean; entity?: EntityType | null }>;
    season?: { type: SeasonType; remaining: number };
  };
  type SaveV2 = Omit<SaveV1, 'v'> & {
    v: 2;
    ecoRepHistory?: Array<{ t: number; v: number }>;
    storyDecisions?: Array<{ id: string; ts: number; eventId: string; eventTitle: string; choiceId: string; choiceLabel: string }>;
  };
  const SAVE_KEY = 'vm_save_v2';
  // Load once on mount
  useEffect(() => {
    try {
  const raw = localStorage.getItem(SAVE_KEY) || localStorage.getItem('vm_save_v1');
      if (!raw) return;
  const data = JSON.parse(raw) as SaveV1 | SaveV2;
  if (!data || (data.v !== 1 && data.v !== 2)) return;
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
      // v2: hydrate ecoRepHistory + storyDecisions if present
      if ('v' in data && data.v === 2) {
        const d2 = data as SaveV2;
        if (Array.isArray(d2.ecoRepHistory)) {
          try { localStorage.setItem('vm_eco_hist', JSON.stringify(d2.ecoRepHistory.slice(-180))); } catch { /* ignore */ }
        }
        if (Array.isArray(d2.storyDecisions)) {
          try { localStorage.setItem('vm_story_decisions', JSON.stringify(d2.storyDecisions.slice(0, 100))); } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }
  }, [seasonPollutionFor, housePollutionFor]);
  // Persist on changes
  useEffect(() => {
    try {
      // pull late-bound extras from localStorage to avoid referencing state before declaration
  const extras: Pick<SaveV2, 'ecoRepHistory' | 'storyDecisions'> = {};
      try {
        const histRaw = localStorage.getItem('vm_eco_hist');
        const decRaw = localStorage.getItem('vm_story_decisions');
        if (histRaw) extras.ecoRepHistory = (JSON.parse(histRaw) as Array<{ t: number; v: number }>).slice(-180);
        if (decRaw) extras.storyDecisions = (JSON.parse(decRaw) as Array<{ id: string; ts: number; eventId: string; eventTitle: string; choiceId: string; choiceLabel: string }>).slice(0, 100);
      } catch { /* ignore */ }
      const save: SaveV2 = {
        v: 2,
        resources,
        pollution,
        tiles: tiles.map(t => ({ id: t.id, x: t.x, y: t.y, isHome: t.isHome, entity: t.entity?.type ?? null })),
        season: { type: season.type, remaining: season.remaining },
        ...extras,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch { /* ignore */ }
  }, [tiles, resources, pollution, season]);

  // Export/import helpers
  const exportSave = useCallback(() => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      // enrich with latest extras from localStorage
      let payloadObj: SaveV2 | null = null;
      if (raw) {
        try { payloadObj = JSON.parse(raw) as SaveV2; } catch { payloadObj = null; }
      }
      if (!payloadObj) {
  const extras: Pick<SaveV2, 'ecoRepHistory' | 'storyDecisions'> = {};
        try {
          const histRaw = localStorage.getItem('vm_eco_hist');
          const decRaw = localStorage.getItem('vm_story_decisions');
          if (histRaw) extras.ecoRepHistory = (JSON.parse(histRaw) as Array<{ t: number; v: number }>).slice(-180);
          if (decRaw) extras.storyDecisions = (JSON.parse(decRaw) as Array<{ id: string; ts: number; eventId: string; eventTitle: string; choiceId: string; choiceLabel: string }> ).slice(0, 100);
        } catch { /* ignore */ }
        payloadObj = {
          v: 2,
          resources,
          pollution,
          tiles: tiles.map(t => ({ id: t.id, x: t.x, y: t.y, isHome: t.isHome, entity: t.entity?.type ?? null })),
          season: { type: season.type, remaining: season.remaining },
          ...extras,
        };
      }
      const payload = JSON.stringify(payloadObj);
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
  }, [tiles, resources, pollution, season]);

  const importInputRef = useRef<HTMLInputElement | null>(null);
  const onImportFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
  const data = JSON.parse(text) as SaveV1 | SaveV2;
  if (!data || (data.v !== 1 && data.v !== 2)) return;
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
        if ('v' in data && data.v === 2) {
          const d2 = data as SaveV2;
          if (Array.isArray(d2.ecoRepHistory)) {
            try { localStorage.setItem('vm_eco_hist', JSON.stringify(d2.ecoRepHistory.slice(-180))); } catch { /* ignore */ }
          }
          if (Array.isArray(d2.storyDecisions)) {
            try { localStorage.setItem('vm_story_decisions', JSON.stringify(d2.storyDecisions.slice(0, 100))); } catch { /* ignore */ }
          }
        }
      } catch { /* ignore */ }
    };
    reader.readAsText(f);
    // reset input to allow importing the same file again if needed
    e.target.value = '';
  }, [createInitialTiles, seasonPollutionFor, housePollutionFor]);

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
  // Story reset
  storyShownRef.current = new Set();
  setActiveStory(null);
  setStoryDiscountPct(0);
  setStoryDiscountTimer(0);
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
  const [showCompendium, setShowCompendium] = useState(false);
  const [compendiumFilter, setCompendiumFilter] = useState<'all' | 'heat' | 'support' | 'history' | 'relations'>('all');
  const [logFilter, setLogFilter] = useState<'all' | LogType>('all');
  // Weather legend fixed overlay state
  const [legendOpen, setLegendOpen] = useState(false);
  const [legendPos, setLegendPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  // Custom tooltip only for Pollution (season info is shown in headline pill)
  const [pollTipOpen, setPollTipOpen] = useState(false);
  const [pollTipPos, setPollTipPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  // Eco‑reputation tooltip state
  const [ecoTipOpen, setEcoTipOpen] = useState(false);
  const [ecoTipPos, setEcoTipPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  // Relations tooltip (for Compendium → Relacje)
  const [relTip, setRelTip] = useState<{ left: number; top: number; text: string } | null>(null);
  // (Ekonomia panel state removed)

  // EcoReputation (0-100), derived from current pollution and number of forests
  const ecoRep = useMemo(() => {
    const forestCount = tiles.filter(t => t.entity?.type === 'forest').length;
    const rep = Math.round((100 - pollution) + Math.min(20, forestCount * 5));
    return Math.max(0, Math.min(100, rep));
  }, [tiles, pollution]);

  // Eco‑reputation tooltip text
  const ecoTooltip = useMemo(() => {
    const forests = tiles.filter(t => t.entity?.type === 'forest').length;
    const lines = [
      `Eko‑reputacja: ${ecoRep}/100`,
      `Formuła: 100 − smog (${Math.round(pollution)}) + min(20, 5×lasy=${5 * forests})`,
      coinBonusPct > 0 ? `Bonus monet: +${coinBonusPct}% (czyste powietrze)` : 'Bonus monet: 0% (smog zbyt wysoki)',
      'Jak poprawić: sadź lasy 🌲, wymień kocioł na czystszy, ogranicz smog.',
      'Efekt: wpływa na wydarzenia i premię do ViCoins.'
    ];
    return lines.join('\n');
  }, [ecoRep, pollution, tiles, coinBonusPct]);

  // EcoReputation history (ring buffer, persisted) sampled ~every 5s
  type EcoSample = { t: number; v: number };
  const [ecoRepHistory, setEcoRepHistory] = useState<EcoSample[]>(() => {
    try {
      const raw = localStorage.getItem('vm_eco_hist');
      const arr = raw ? JSON.parse(raw) as EcoSample[] : [];
      return Array.isArray(arr) ? arr.slice(-180) : [];
    } catch { return []; }
  });
  const ecoSampleRef = useRef<number>(0);
  useEffect(() => {
    const now = Date.now();
    if (now - ecoSampleRef.current >= 5000 || ecoRepHistory.length === 0) {
      ecoSampleRef.current = now;
      setEcoRepHistory(prev => {
        const next = [...prev, { t: now, v: ecoRep }].slice(-180);
        try { localStorage.setItem('vm_eco_hist', JSON.stringify(next)); } catch { /* ignore */ }
        return next;
      });
    }
  }, [ecoRep, ecoRepHistory.length]);

  // EcoRep stage change notifications (one-off per stage)
  const ecoStageRef = useRef<number>(-1);
  const ecoHydratedRef = useRef(false);
  useEffect(() => {
    // Stages: 0:<40 (niska), 1:40-69 (średnia), 2:70+ (wysoka)
    const s = ecoRep < 40 ? 0 : ecoRep < 70 ? 1 : 2;
    if (!ecoHydratedRef.current) { ecoHydratedRef.current = true; ecoStageRef.current = s; return; }
    if (s !== ecoStageRef.current) {
      const map = [
        { icon: '🚫', msg: 'Niska eko‑reputacja – rozważ sadzenie lasów i czystsze źródła.' },
        { icon: '⚖️', msg: 'Średnia eko‑reputacja – idzie ku lepszemu.' },
        { icon: '🌟', msg: 'Wysoka eko‑reputacja – społeczność jest zachwycona!' },
      ];
      const info = map[s];
      pushToast({ icon: info.icon, text: info.msg });
      pushLog({ type: 'other', icon: info.icon, title: 'Zmiana eko‑reputacji', description: info.msg });
      ecoStageRef.current = s;
    }
  }, [ecoRep]);

  // EcoRep short trend for UI (delta over ~last 5 samples)
  const ecoRepTrend = useMemo(() => {
    const n = ecoRepHistory.length;
    if (n < 2) return 0;
    const prevIdx = Math.max(0, n - 6);
    return +(ecoRepHistory[n - 1].v - ecoRepHistory[prevIdx].v).toFixed(0);
  }, [ecoRepHistory]);

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
  // Story decisions log (compact)
  type Decision = { id: string; ts: number; eventId: string; eventTitle: string; choiceId: string; choiceLabel: string };
  const [storyDecisions, setStoryDecisions] = useState<Decision[]>(() => {
    try {
      const raw = localStorage.getItem('vm_story_decisions');
      const arr = raw ? JSON.parse(raw) as Decision[] : [];
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem('vm_story_decisions', JSON.stringify(storyDecisions)); } catch { /* ignore */ }
  }, [storyDecisions]);
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
  const canAfford = useCallback((c: Cost) => canAffordHelper(resources, c), [resources]);
  // Combine regular and story-driven temporary discounts
  const discountedCost = useCallback((cost: Cost): Cost => discountedCostHelper(cost, Math.min(90, priceDiscountPct + storyDiscountPct)), [priceDiscountPct, storyDiscountPct]);
  // removed unused multiplyCost helper alias (moved to lib if needed)
  // Dynamic pricing:
  // - forest: base + linear bump per owned (+8 ☀️/+8 💧 each)
  // - solar: geometric scaling +15% per owned
  // - echarger: geometric scaling +18% per owned
  const dynamicCost = useCallback((item: ShopItem): Cost => dynamicCostHelper(item.key, discountedCost(item.cost), owned), [discountedCost, owned]);
  // charge is applied on placement time, so we don't pre-pay on Buy
  const modifyBaseRates = (fn: (r: Record<ResKey, number>) => Record<ResKey, number>) => setBaseRates(r => fn({ ...r }));
  const effectsCtx: EffectsContext = useMemo(() => ({
    addRate: (k, d) => modifyBaseRates(r => ({ ...r, [k]: (r[k] ?? 0) + d })),
    multiplyAll: (m) => modifyBaseRates(r => { const n = { ...r } as Record<ResKey, number>; (Object.keys(n) as ResKey[]).forEach(k => n[k] *= m); return n; }),
    discountNextPurchasesPct: (pct) => setPriceDiscountPct(p => Math.min(90, p + pct)),
  }), []);
  // Pollution contribution per house device moved earlier for availability

  // Loop
  useEffect(() => {
    const id = setInterval(() => {
      setResources(r => ({
        sun: r.sun + effectiveRates.sun,
        wind: r.wind + effectiveRates.wind,
        water: r.water + effectiveRates.water,
        coins: r.coins + effectiveRates.coins,
      }));
      setElapsed(e => {
        const n = e + 1;
        elapsedRef.current = n;
        return n;
      });
      if (hasECharger) {
        echargerBonusRef.current += 1;
        if (echargerBonusRef.current >= 60) { echargerBonusRef.current = 0; setResources(r => ({ ...r, coins: r.coins + 5 })); }
      }
    setPollution(p => clamp(p + pollutionRate));

  // Story: timer decay for temporary discounts
  setStoryDiscountTimer(t => {
        if (t <= 1) {
            if (t === 1) { setStoryDiscountPct(0); setStoryDiscountLabel(null); }
          return 0;
        }
        return t - 1;
      });

      // Trigger next eligible story event (at most one active at a time)
      if (!activeStory && storyEventsRef.current) {
        const ctx: StoryContext = {
          elapsed: elapsedRef.current,
          pollution,
          hasCoal: tiles.some(t => t.isHome && t.entity?.type === 'coal'),
          renewablesUnlocked,
          season: season.type,
          ecoRep,
          forests: tiles.filter(t => t.entity?.type === 'forest').length,
          flags: storyFlags,
          factions,
          resources,
        };
        // respect cooldowns and once flag
        const now = Date.now();
        const eligible = storyEventsRef.current.filter(e => e.condition(ctx) && !storyShownRef.current.has(e.id) && (!storyCooldownsRef.current[e.id] || storyCooldownsRef.current[e.id] <= now));
        // weighted pick (default weight 1)
        let ev: typeof eligible[number] | undefined;
        if (eligible.length > 0) {
          const weights = eligible.map(e => Math.max(1, e.weight ?? 1));
          const total = weights.reduce((a,b)=>a+b,0);
          let r = Math.random() * total;
          for (let i=0;i<eligible.length;i++){ r -= weights[i]; if (r<=0){ ev = eligible[i]; break; } }
          ev = ev || eligible[eligible.length-1];
        }
        if (ev) setActiveStory(ev);
      }

      // Konsumpcja zasobów i koszty utrzymania (co 1s)
      setResources(r => {
        const n = { ...r } as Record<ResKey, number>;
        // 1) Zapotrzebowanie bazowe domu – działa gdy jest jakiekolwiek źródło ciepła
        const hasHeat = tiles.some(t => t.isHome && t.entity && houseUpgradeKeys.includes(t.entity.type as EntityType));
        if (hasHeat) {
          // sezon/pogoda modyfikuje popyt (zimą większy)
          const seasonDemand = season.type === 'winter' ? 1.3 : season.type === 'summer' ? 0.9 : 1.0;
          // podczas mrozu zapotrzebowanie skacze
          const frostMult = weatherEvent.type === 'frost' ? 1.5 : 1.0;
          const baseSun = 0.02 * seasonDemand * frostMult;
          const baseWater = 0.015 * seasonDemand;
          const baseWind = 0.015 * seasonDemand;
          n.sun = Math.max(0, n.sun - baseSun);
          n.water = Math.max(0, n.water - baseWater);
          n.wind = Math.max(0, n.wind - baseWind);
        }

        // 2) Utrzymanie posiadanych urządzeń (coin sink) – rośnie z liczbą sztuk
        const upkeepPer: Partial<Record<EntityType, number>> = {
          forest: 0.02, // pielęgnacja
          solar: 0.03,  // serwis
          inverter: 0.02,
          grid: 0.01,
          thermostat: 0.005,
          echarger: 0.02,
          lab: 0.05, // drogie utrzymanie, ale daje stały boost
        };
        let upkeep = 0;
        for (const [k, v] of Object.entries(upkeepPer)) {
          const count = placedCounts[k as EntityType] ?? 0;
          upkeep += (v ?? 0) * count;
        }
        // Eco‑podatek w zależności od smogu (zachęta do budowy lasów i czystych źródeł)
        const ecoTax = pollution > 40 ? (pollution - 40) * 0.002 : 0; // do +0.12/s przy 100 smogu
        n.coins = Math.max(0, n.coins - upkeep - ecoTax);
        return n;
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [effectiveRates, hasECharger, pollutionRate, clamp, tiles, placedCounts, season.type, weatherEvent.type, pollution, activeStory, renewablesUnlocked, ecoRep, storyFlags, factions, resources]);

  // Story API adapter
  const storyApi = useMemo<StoryApi>(() => ({
    grantCoins: (amount) => setResources(r => ({ ...r, coins: r.coins + amount })),
    grantResources: (delta) => setResources(r => ({
      sun: r.sun + (delta?.sun ?? 0),
      water: r.water + (delta?.water ?? 0),
      wind: r.wind + (delta?.wind ?? 0),
      coins: r.coins + (delta?.coins ?? 0),
    })),
    addPollutionInstant: (delta) => setPollution(p => clamp(p + delta)),
    setGlobalDiscount: (pct, seconds, label) => {
      setStoryDiscountPct(d => Math.max(d, Math.floor(pct)));
      setStoryDiscountTimer(t => Math.max(t, Math.floor(seconds)));
  if (label) { setStoryDiscountLabel(label); pushToast({ icon: '🏷️', text: `${label}: −${Math.round(pct)}% przez ${seconds}s` }); }
    },
    toast: (icon, text) => pushToast({ icon, text }),
    log: (title, description, icon) => pushLog({ type: 'other', icon: icon ?? '🗞️', title, description }),
    unlockRenewables: () => setRenewablesUnlocked(true),
    setFlag: (key, value) => setStoryFlags(prev => ({ ...prev, [key]: value })),
    adjustFaction: (name, delta) => setFactions(prev => ({ ...prev, [name]: clamp((prev[name] ?? 0) + delta) })),
    setEventCooldown: (eventId, seconds) => { storyCooldownsRef.current[eventId] = Date.now() + seconds * 1000; },
  }), [clamp]);

  const handleStoryChoice = useCallback((choice: StoryChoice) => {
    try { choice.apply(storyApi); } catch { /* ignore */ }
    // Record decision in a dedicated story decisions log
    try {
      const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
        ts: Date.now(),
        eventId: activeStory?.id || 'unknown',
        eventTitle: activeStory?.title || 'Wydarzenie',
        choiceId: choice.id,
        choiceLabel: choice.label,
      };
      setStoryDecisions(prev => [entry, ...prev].slice(0, 100));
    } catch { /* ignore */ }
    if (activeStory?.once !== false) storyShownRef.current.add(activeStory!.id);
    // Apply event cooldown if specified
    if (activeStory?.cooldownSec && activeStory.cooldownSec > 0) {
      storyCooldownsRef.current[activeStory.id] = Date.now() + activeStory.cooldownSec * 1000;
    }
    setActiveStory(null);
  }, [activeStory, storyApi]);

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

  const visibleProduction = useMemo(() => {
    // Determine current house stage key and index
    const home = tiles.find(t => t.isHome);
    const currentKey = home?.entity && houseUpgradeKeys.includes(home.entity.type as EntityType)
      ? (home.entity.type as EntityType)
      : undefined;
    const currentIdx = currentKey ? houseUpgradeKeys.indexOf(currentKey) : -1;
    return productionItems.filter(it => {
      if (!it.requires || it.requires.length === 0) return true;
      return it.requires.every((req) => {
        // If requirement is a house-stage key, allow when current stage >= required stage
        if (houseUpgradeKeys.includes(req as EntityType)) {
          if (currentIdx < 0) return false;
          const reqIdx = houseUpgradeKeys.indexOf(req as EntityType);
          return currentIdx >= reqIdx;
        }
        // Fallback for non-house requirements (if ever added): use owned flag
        return (owned[req as EntityType] ?? 0) > 0;
      });
    });
  }, [tiles, owned]);
  // Shop: start placement for an item
  const handleBuy = (item: ShopItem) => {
    if (isSinglePurchase(item.key) && (owned[item.key] ?? 0) > 0) return;
    const cost = dynamicCost(item);
    if (!canAfford(cost)) return;
    // Opłata i log przeniesione na moment umieszczenia na mapie
    setPendingPlacement(item);
  };

  // Place currently pending item on a tile
  const placeOnTile = useCallback((tile: Tile) => {
    if (!pendingPlacement) return;
    const isHouse = houseUpgradeKeys.includes(pendingPlacement.key);
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
      // Rezerwacja obrzeża wyłącznie dla lasów: inne elementy nie mogą stać na krawędziach
      const onPerimeter = tile.x === 0 || tile.y === 0 || tile.x === SIZE - 1 || tile.y === SIZE - 1;
      if (pendingPlacement.key !== 'forest' && onPerimeter) return;
    }

    // Before placing, re-check affordability and deduct cost now (handles ESC cancel case)
    const placingItem = pendingPlacement;
    const placeCost = dynamicCost(placingItem);
    if (!canAfford(placeCost)) return;
    setResources(r => {
      const n = { ...r } as Record<ResKey, number>;
      for (const [k, v] of Object.entries(placeCost)) n[k as ResKey] -= v ?? 0;
      return n;
    });

    const instance: EntityInstance = { type: placingItem.key, label: placingItem.name, icon: placingItem.icon };
    // Ustaw/Podmień na kafelku
    setTiles(ts => ts.map(t => t.id === tile.id ? { ...t, entity: instance } : t));

    // Licznik posiadanych + efekty
    if (isHouse) {
      setOwned(o => {
        const n: Record<EntityType | 'coal', number> = { ...(o as Record<EntityType | 'coal', number>) };
        houseUpgradeKeys.forEach(k => { n[k] = 0; });
        n[placingItem.key] = 1;
        return n;
      });
      // Pollution: apply delta vs previous house state using helper
      const prevHouse = housePollutionRef.current;
      const nextHouse = housePollutionFor(pendingPlacement.key);
      if (nextHouse !== prevHouse) {
        addPollutionRate(nextHouse - prevHouse);
        housePollutionRef.current = nextHouse;
      }

      // Additional progression effects
      if (placingItem.key === 'pellet') {
        setRenewablesUnlocked(true);
        setBaseRates(r => ({
          ...r,
          sun: Math.max(r.sun, 0.2),
          wind: Math.max(r.wind, 0.15),
          water: Math.max(r.water, 0.15),
          coins: Math.max(r.coins, 0.05)
        }));
        setResources(res => ({ ...res, sun: res.sun + 5, water: res.water + 5, wind: res.wind + 5 }));
      }
    } else {
      setOwned(o => ({ ...o, [placingItem.key]: (o[placingItem.key] ?? 0) + 1 }));
      if (placingItem.key === 'echarger') setHasECharger(true);
      if (placingItem.key === 'forest') addPollutionRate(-0.5);
      placingItem.onPurchaseEffects?.(effectsCtx);
    }

    const costStr = [
      placeCost.sun ? `${placeCost.sun} ☀️` : null,
      placeCost.water ? `${placeCost.water} 💧` : null,
      placeCost.wind ? `${placeCost.wind} 🌬️` : null,
      placeCost.coins ? `${placeCost.coins} 💰` : null,
    ].filter(Boolean).join(" + ") || "—";
    pushLog({ type: 'placement', icon: instance.icon, title: `Ustawiono: ${instance.label}`, description: `Kafelek: ${tile.id} • Koszt: ${costStr}` });
    setPendingPlacement(null); setLastPlacedKey(tile.id);
  }, [pendingPlacement, dynamicCost, canAfford, setResources, setTiles, setOwned, setBaseRates, addPollutionRate, tiles, homeTileId, effectsCtx, housePollutionFor]);

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
  }, [tiles, pollutionRate, housePollutionFor]);

  // Season tooltip removed; season details are now shown in the headline pill

  // Headline ticker: three-line layout (title, second line, third line) to match other pills
  const headlineInfo = useMemo(() => {
    // Discount active
    if (storyDiscountTimer > 0 && storyDiscountPct > 0) {
      return {
        title: storyDiscountLabel || 'Zniżka',
        line2: `−${Math.round(storyDiscountPct)}%`,
        line3: `${storyDiscountTimer}s`,
      } as const;
    }
    // Smog pressure warning
    if (pollution > 50 && smogMultiplier < 1) {
      return {
        title: 'Smog',
        line2: `Produkcja −${Math.round((1 - smogMultiplier) * 100)}%`,
        line3: '',
      } as const;
    }
    // Season default: name on second line, effects + remaining on third
    const seasonMap: Record<SeasonType, { name: string; icon: string; eff: string }> = {
      spring: { name: 'Wiosna', icon: '🌸', eff: '💧 x1.3, smog −0.01/s' },
      summer: { name: 'Lato', icon: '☀️', eff: '☀️ x1.3, smog −0.02/s' },
      autumn: { name: 'Jesień', icon: '🍂', eff: '🌧️/🌬️ x1.2, smog ±0' },
      winter: { name: 'Zima', icon: '❄️', eff: '☀️ x0.7, smog +0.05/s' },
    };
    const s = seasonMap[season.type];
    return {
      title: 'Sezon',
      line2: s.name,
      line3: `${s.eff} • ${season.remaining}s`,
    } as const;
  }, [storyDiscountTimer, storyDiscountPct, storyDiscountLabel, pollution, smogMultiplier, season.type, season.remaining]);

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
  {/* Story modal */}
  <StoryModal event={activeStory} onChoose={handleStoryChoice} onClose={() => setActiveStory(null)} isDay={isDay} />
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
          {/* spacer between resource pills and the rest */}
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
              </div>
              <div className="font-semibold font-sans tabular-nums" style={{ color: isDay ? "#111" : "#FDE68A" }}>{fmt(resources.coins)}</div>
              <div className="font-sans tabular-nums" style={{ fontSize: 11, marginTop: 2, color: isNearZeroRate('coins') ? (isDay ? '#94a3b8' : '#64748b') : (isDay ? '#64748b' : '#94a3b8') }}>{rateText('coins')}</div>
            </div>
          </div>
          {/* przerwa między zasobami a Sezon/Pogoda/Zanieczyszczenie */}
          <div style={{ width: 16 }} />
          {/* Headline ticker (Sezon) */}
          <div
            style={{
              ...pill,
              background: isDay ? "rgba(255,255,255,0.7)" : "#0f172a",
              padding: "6px 16px",
              minWidth: 160,
              maxWidth: 260,
              overflow: 'hidden'
            }}
            title={[headlineInfo.title, headlineInfo.line2, headlineInfo.line3].filter(Boolean).join(' • ')}
          >
            <span style={{ fontSize: 16 }}>📰</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 12, fontFamily: 'Manrope, system-ui, sans-serif', color: isDay ? "#334155" : "#F1F5F9" }}>{headlineInfo.title}</div>
              <div className="font-semibold font-sans" style={{ color: isDay ? "#111" : "#F1F5F9" }}>{headlineInfo.line2}</div>
              {headlineInfo.line3 ? (
                <div className="font-sans tabular-nums" style={{ fontSize: 11, marginTop: 2, color: isDay ? '#64748b' : '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{headlineInfo.line3}</div>
              ) : null}
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
              {/* Label to vertically align with other pills */}
              <div style={{ fontWeight: 700, fontSize: 12, fontFamily: 'Manrope, system-ui, sans-serif', color: isDay ? "#334155" : "#F1F5F9" }}>Pogoda</div>
              <div style={{ fontWeight: 700, fontSize: 12, color: isDay ? "#0ea5e9" : "#bae6fd", marginTop: 2 }}>
                {weatherEvent.type === "clouds" && "Chmury"}
                {weatherEvent.type === "sunny" && "Słońce"}
                {weatherEvent.type === "rain" && "Deszcz"}
                {weatherEvent.type === "wind" && "Wiatr"}
                {weatherEvent.type === "storm" && "Burza"}
                {weatherEvent.type === "frost" && "Mróz"}
                {weatherEvent.type === "none" && "Brak wydarzenia"}
              </div>
              <div style={{ fontSize: 13, color: isDay ? "#334155" : "#e0f2fe", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>
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
              <div className="font-sans tabular-nums" style={{ fontSize: 11, marginTop: 2, display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ color: pollutionRate < 0 ? '#059669' : '#ef4444' }}>
                  {pollutionRate >= 0 ? '+' : ''}{fmt(pollutionRate)}/s
                </span>
                {smogMultiplier < 1 && (
                  <span style={{ color: isDay ? '#64748b' : '#94a3b8' }}>
                    Produkcja −{Math.round((1 - smogMultiplier) * 100)}%
                  </span>
                )}
              </div>
            </div>
          </div>
          {/* Eco‑Reputacja */}
          <div
            style={{
              ...pill,
              background: isDay ? "rgba(255,255,255,0.7)" : "#0f172a",
              padding: "6px 24px"
            }}
            onMouseEnter={(e) => {
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setEcoTipPos({ left: r.left + r.width / 2, top: r.bottom + 8 });
              setEcoTipOpen(true);
            }}
            onMouseLeave={() => setEcoTipOpen(false)}
            onFocus={(e) => {
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setEcoTipPos({ left: r.left + r.width / 2, top: r.bottom + 8 });
              setEcoTipOpen(true);
            }}
            onBlur={() => setEcoTipOpen(false)}
            tabIndex={0}
            title="Eko‑reputacja"
          >
            <span style={{ fontSize: 18 }}>🌿</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 12, fontFamily: 'Manrope, system-ui, sans-serif', color: isDay ? "#334155" : "#F1F5F9" }}>Eko‑reputacja</div>
              <div className="font-semibold font-sans tabular-nums" style={{ color: isDay ? "#111" : "#86efac" }}>{ecoRep}</div>
              <div className="font-sans tabular-nums" style={{ fontSize: 11, marginTop: 2, color: coinBonusPct > 0 ? (isDay ? '#166534' : '#86efac') : (isDay ? '#64748b' : '#94a3b8') }}>
                {coinBonusPct > 0 ? `Bonus monet +${coinBonusPct}%` : 'Brak bonusu'}
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }} className="text-base font-medium font-sans">
          <span className="font-medium font-sans">{isDay ? "☀️ Dzień" : "🌙 Noc"}</span>
          <div style={{ width: 80, height: 8, borderRadius: 6, background: "#e5e7eb", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${phasePct}%`, background: "#111" }} />
          </div>
        </div>

  {/* Season pill removed – season info moved to the headline ticker */}

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
              {/* (Eco‑reputation quick summary removed as redundant; info available in header pill tooltip) */}
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

              {/* Kompendium wiedzy */}
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
                  setShowCompendium(true);
                  setShowProfileMenu(false);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setShowCompendium(true);
                    setShowProfileMenu(false);
                  }
                }}
                onMouseEnter={(e) => (e.target as HTMLElement).style.background = isDay ? '#f3f4f6' : '#1f2937'}
                onMouseLeave={(e) => (e.target as HTMLElement).style.background = 'transparent'}
              >
                <span>📚</span>
                <span>Kompedium wiedzy</span>
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
  {/* Season tooltip removed – unified into headline ticker */}
      {/* Eco‑reputacja tooltip */}
      {ecoTipOpen && (
        <div
          style={{
            position: 'fixed',
            left: ecoTipPos.left,
            top: ecoTipPos.top,
            transform: 'translateX(-50%)',
            minWidth: 240,
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
          aria-hidden={true}
        >
          {ecoTooltip.split('\n').map((line, i) => (
            <div key={i} style={{ color: i === 2 && coinBonusPct > 0 ? (isDay ? '#166534' : '#86efac') : (isDay ? '#334155' : '#94a3b8'), fontWeight: i <= 1 ? 700 : 500 }}>
              {line}
            </div>
          ))}
        </div>
      )}
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
          }}
          aria-hidden={true}
        >
          {pollutionTooltip.split('\n').map((line, i) => (
            <div key={i} style={{ color: i === 2 ? (pollutionRate < 0 ? '#059669' : '#ef4444') : (isDay ? '#334155' : '#94a3b8'), fontWeight: i === 2 ? 700 : 500 }}>
              {line}
            </div>
          ))}
        </div>
      )}
      {relTip && (
        <div
          style={{
            position: 'fixed',
            left: relTip.left,
            top: relTip.top,
            transform: 'translateX(-50%)',
            minWidth: 260,
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
            whiteSpace: 'pre-wrap'
          }}
          aria-hidden={true}
        >
          {relTip.text}
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
          aria-hidden={true}
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
        <section style={{ ...card, position: 'relative' }}>
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
              const isForest = item.key === 'forest';
              const isSolar = item.key === 'solar';
              const isECharger = item.key === 'echarger';
              const forestOwned = owned.forest ?? 0;
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span className="font-bold font-sans text-base" style={{ fontWeight: 700 }}>{item.name}</span>
                        {isForest && (
                          <span
                            title="Las można sadzić wyłącznie na skraju mapy (zewnętrzny pierścień)."
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              letterSpacing: 0.3,
                              textTransform: 'uppercase',
                              padding: '2px 6px',
                              borderRadius: 999,
                              background: isDay ? '#dcfce7' : '#064e3b',
                              color: isDay ? '#065f46' : '#d1fae5',
                              border: isDay ? '1px solid #bbf7d0' : '1px solid #065f46'
                            }}
                          >Tylko na obrzeżach</span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-500 font-sans" style={{ fontSize: 11, marginTop: 2, marginBottom: 2 }}>Posiadane: {ownedCount}</div>
                      <div className="font-normal text-xs text-neutral-600 font-sans" style={{ fontSize: 13 }}>{item.description}</div>
                      {isForest && (
                        <div
                          title="Każdy kolejny las jest droższy o +8 ☀️ i +8 💧."
                          style={{ fontSize: 11, marginTop: 4, color: isDay ? '#64748b' : '#94a3b8' }}
                        >
                          Cena rośnie: +8 ☀️ +8 💧 za każdy posiadany las{forestOwned > 0 ? ` (masz ${forestOwned})` : ''}.
                        </div>
                      )}
                      {isSolar && (
                        <div
                          title="Każdy kolejny panel PV drożeje geometrycznie (+15% od bazowej ceny za każdą posiadaną sztukę)."
                          style={{ fontSize: 11, marginTop: 4, color: isDay ? '#64748b' : '#94a3b8' }}
                        >
                          Cena rośnie: ~+15% względem bazowej za każdy posiadany panel.
                        </div>
                      )}
                      {isECharger && (
                        <div
                          title="Każdy kolejny E‑Charger drożeje geometrycznie (+18% od bazowej ceny za każdą posiadaną sztukę)."
                          style={{ fontSize: 11, marginTop: 4, color: isDay ? '#64748b' : '#94a3b8' }}
                        >
                          Cena rośnie: ~+18% względem bazowej za każdy posiadany E‑Charger.
                        </div>
                      )}
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
        </section>

  {/* map */}
  <section style={{ ...card, position: 'relative' }}>
          {/* Animacje pogodowe przeniesione do IsoGrid */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <h2 className="font-bold font-sans text-lg text-neutral-900">Dom i otoczenie</h2>
          </div>
          <IsoGrid
            ref={isoRef}
            tiles={tiles}
            homeTileId={homeTileId}
            onTileClick={placeOnTile}
            pendingItem={pendingPlacement ? { key: pendingPlacement.key, name: pendingPlacement.name, icon: pendingPlacement.icon } : null}
            lastPlacedKey={lastPlacedKey}
            onViewChange={setIsoView}
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
                const onPerimeter = t.x === 0 || t.y === 0 || t.x === SIZE - 1 || t.y === SIZE - 1;
                // forests only on perimeter ring; other non-house items forbidden on perimeter
                if (pendingPlacement.key === 'forest') {
                  if (!onPerimeter) return false;
                } else {
                  if (onPerimeter) return false;
                }
                return !t.entity;
              }
            }}
            weatherEvent={weatherEvent}
            isDay={isDay}
          />
          {/* Minimap anchored to section bottom-right */}
          {isoView && (
            <div
              onClick={(e) => {
                if (!isoView) return;
                const mmW = 160, mmH = 160;
                const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                const mx = (e.clientX - rect.left) - 6; // padding
                const my = (e.clientY - rect.top) - 6;
                const sx = mmW / isoView.contentW, sy = mmH / isoView.contentH;
                const worldX = mx / sx;
                const worldY = my / sy;
                isoRef.current?.centerWorld(worldX, worldY);
              }}
              title="Kliknij, aby przesunąć widok"
              style={{ position: 'absolute', right: 8, bottom: 8, width: 172, height: 172, padding: 6, borderRadius: 10, border: isDay ? '1px solid #e5e7eb' : '1px solid #334155', background: isDay ? 'rgba(255,255,255,0.9)' : '#0b1220', color: isDay ? '#0f172a' : '#e5e7eb', zIndex: 6, boxShadow: isDay ? '0 6px 18px rgba(0,0,0,0.08)' : '0 6px 18px rgba(0,0,0,0.35)', cursor: 'pointer' }}
            >
              {(() => {
                const { contentW, contentH, tileW, tileH, baseX, baseY, offset, scale, viewport } = isoView;
                const mmW = 160, mmH = 160;
                const sx = mmW / contentW, sy = mmH / contentH;
                const tileCenter = (t: Tile) => ({
                  x: ((t.x - t.y) * (tileW / 2) + baseX + tileW / 2) * sx,
                  y: ((t.x + t.y) * (tileH / 2) + baseY + tileH / 2) * sy,
                });
                const worldMinX = Math.max(0, (-offset.x) / scale);
                const worldMinY = Math.max(0, (-offset.y) / scale);
                const worldMaxX = Math.min(contentW, (viewport.w - offset.x) / scale);
                const worldMaxY = Math.min(contentH, (viewport.h - offset.y) / scale);
                const viewRect = {
                  x: worldMinX * sx,
                  y: worldMinY * sy,
                  w: Math.max(0, (worldMaxX - worldMinX) * sx),
                  h: Math.max(0, (worldMaxY - worldMinY) * sy),
                };
                return (
                  <svg width={mmW} height={mmH} style={{ display: 'block' }}>
                    <rect x={0.5} y={0.5} width={mmW - 1} height={mmH - 1} fill={isDay ? '#f8fafc' : '#111827'} stroke={isDay ? '#e5e7eb' : '#334155'} />
                    {tiles.map((t: IsoTileType) => {
                      const c = tileCenter(t as unknown as Tile);
                      const isHomeT = t.id === homeTileId;
                      const e = t.entity;
                      if (!isHomeT && !e) return null;
                      const color = isHomeT ? '#f59e0b' : e?.type === 'forest' ? '#10b981' : '#64748b';
                      const r = isHomeT ? 3.5 : 2.5;
                      return <circle key={t.id} cx={c.x} cy={c.y} r={r} fill={color} stroke={isDay ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'} />;
                    })}
                    <rect x={viewRect.x} y={viewRect.y} width={viewRect.w} height={viewRect.h} fill="none" stroke={isDay ? '#3b82f6' : '#60a5fa'} strokeWidth={1.5} />
                  </svg>
                );
              })()}
            </div>
          )}
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

      {/* Kompendium wiedzy Popup */}
      {showCompendium && (
        <div
          onClick={(e) => { if (e.currentTarget === e.target) setShowCompendium(false); }}
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
            maxWidth: 900,
            width: "min(94vw,900px)",
            maxHeight: "80vh",
            overflow: "auto",
            margin: 20,
            boxShadow: isDay ? "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" : "0 20px 40px rgba(0,0,0,0.5)",
            border: isDay ? "1px solid #e5e7eb" : "1px solid #334155"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>📚 Kompendium wiedzy</h2>
              <button 
                onClick={() => setShowCompendium(false)}
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', padding: 4, color: isDay ? '#666' : '#94a3b8' }}
                aria-label="Zamknij"
              >✕</button>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {([
                { k: 'all', label: 'Wszystko' },
                { k: 'heat', label: 'Urządzenia grzewcze' },
                { k: 'support', label: 'Urządzenia wspierające' },
                { k: 'history', label: 'Historia' },
                { k: 'relations', label: 'Relacje' },
              ] as Array<{ k: 'all' | 'heat' | 'support' | 'history' | 'relations'; label: string }>).map(btn => (
                <button key={btn.k}
                  onClick={() => setCompendiumFilter(btn.k)}
                  style={{
                    background: compendiumFilter === btn.k ? (isDay ? '#0f172a' : '#334155') : (isDay ? '#f1f5f9' : '#1f2937'),
                    color: compendiumFilter === btn.k ? (isDay ? '#ffffff' : '#e5e7eb') : (isDay ? '#334155' : '#94a3b8'),
                    border: isDay ? '1px solid #e5e7eb' : '1px solid #334155',
                    borderRadius: 999, padding: '6px 10px', cursor: 'pointer', fontSize: 12
                  }}
                >{btn.label}</button>
              ))}
            </div>

            {/* Content */}
            {(() => {
              const sectionTitle = (text: string) => (
                <h3 style={{ margin: '12px 0 8px', fontSize: 18, fontWeight: 700, color: isDay ? '#0f172a' : '#e5e7eb' }}>{text}</h3>
              );
              const Card = ({ icon, title, desc }: { icon?: string; title: string; desc: string }) => (
                <div style={{ display: 'flex', gap: 12, padding: 12, borderRadius: 12, background: isDay ? '#f9fafb' : '#111827', border: isDay ? '1px solid #e5e7eb' : '1px solid #334155' }}>
                  <div style={{ fontSize: 22 }}>{icon ?? '•'}</div>
                  <div>
                    <div style={{ fontWeight: 700 }}>{title}</div>
                    <div style={{ fontSize: 14, color: isDay ? '#475569' : '#94a3b8' }}>{desc}</div>
                  </div>
                </div>
              );
              // Relations helpers
              const rel = (name: string) => Math.max(-100, Math.min(100, Math.round(factions[name] ?? 0)));
              const relColor = (v: number) => v >= 25 ? (isDay ? '#16a34a' : '#22c55e') : v <= -25 ? (isDay ? '#dc2626' : '#f87171') : (isDay ? '#f59e0b' : '#fbbf24');
              const Bar = ({ v }: { v: number }) => {
                const pct = (v + 100) / 2; // map -100..100 -> 0..100
                return (
                  <div style={{ height: 8, background: isDay ? '#e5e7eb' : '#334155', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: relColor(v) }} />
                  </div>
                );
              };
              const relTipText = (name: 'community' | 'suppliers') => {
                if (name === 'community') {
                  return [
                    'Co podnosi: sadzenie lasów, niska emisja smogu, decyzje pro‑eko (np. ogród społeczny, edukacja).',
                    'Co obniża: odmowa wsparcia inicjatyw, wysoki smog.',
                    'Progi korzyści: ≥25 – większa szansa na przychylne wydarzenia; ≥50 – mogą pojawiać się inicjatywy społeczne; ≤−25 – większe ryzyko krytyki i mniej korzystnych opcji.'
                  ].join('\n');
                }
                // suppliers
                return [
                  'Co podnosi: porozumienia (MoU), wspólne kampanie, dobre wyniki modernizacji.',
                  'Co obniża: odrzucanie ofert, nastawienie na pełną niezależność.',
                  'Progi korzyści: ≥10 – lepsze oferty; ≥25 – częstsze rabaty i follow‑upy; ≤−20 – część ofert może być zablokowana.'
                ].join('\n');
              };

              const heatItems = [
                { icon: '🔥', title: 'Kocioł tradycyjny żeliwny', desc: 'Duże zanieczyszczenie środowiska, wysoka wydajność.' },
                { icon: '🧰', title: 'Stalowy kocioł grzewczy (1917–1928)', desc: 'Kotły ze spawanych rur stalowych – trwalsze, szybciej się nagrzewają i zużywają mniej paliwa niż tradycyjne.' },
                { icon: '♨️', title: 'Kocioł Triola (1957)', desc: 'Stalowy piec z wbudowanym podgrzewaczem wody; łatwa konwersja z koksu na olej opałowy.' },
                { icon: '🛢️', title: 'Kocioł na olej Parola (1965)', desc: 'Niskie emisje zanieczyszczeń i wysoka sprawność.' },
                { icon: '🧪', title: 'Pierwszy kocioł ze stali nierdzewnej (1972)', desc: 'Lżejszy i wydajniejszy. Lepsza wymiana ciepła, mniej osadów, łatwiejsze czyszczenie. Prekursor kotłów kondensacyjnych.' },
                { icon: '🌀', title: 'Pierwsza pompa ciepła (1978)', desc: 'Wykorzystuje energię z otoczenia (powietrza, gruntu) do celów grzewczych.' },
                { icon: '🌡️', title: 'Kocioł niskotemperaturowy Vitola (1978)', desc: 'Biferral z podwójną stalowo‑żeliwną powierzchnią. Praca przy ~40°C zamiast ~70°C – dopasowanie do zapotrzebowania.' },
                { icon: '🔥💧', title: 'Kocioł gazowy Vitodens (1989)', desc: 'Kondensacja pary wodnej ze spalin – wyższa sprawność i niższe emisje niż w tradycyjnych urządzeniach.' },
                { icon: '🔋', title: 'Pompa ciepła (Vitocal)', desc: 'Wysoka efektywność i OZE. W grze odblokowuje zielone instalacje.' },
              ];

              const supportItems = [
                { icon: '🌲', title: 'Las', desc: 'Silnie redukuje zanieczyszczenie (−0.5/s). Każdy kolejny jest droższy.' },
                { icon: '☀️', title: 'Pierwszy kolektor słoneczny (1972)', desc: 'Wykorzystanie energii odnawialnej ze słońca, redukując zużycie oleju czy gazu.' },
                { icon: '🧰', title: 'Technologia kondensacyjna (Inox‑Radial)', desc: 'Odblokowuje generację gazowych kotłów kondensacyjnych i zmniejsza emisje.' },
                { icon: '🧱', title: 'Ogrzewanie podłogowe', desc: 'Wyższy komfort przy niższej temperaturze zasilania – lepsza efektywność. Skraca działanie mrozu.' },
                { icon: '🌡️', title: 'Termostaty SRC', desc: 'Inteligentne sterowanie – dokładniejsza regulacja i oszczędności. Zwiększa generowanie zasobów.' },
                { icon: '🔶', title: 'Inverter / magazyn (Vitocharge)', desc: 'Magazynowanie i zarządzanie energią. Lepsze wykorzystanie produkcji. Zwiększa generowanie ViCoinów.' },
                { icon: '⚡', title: 'Grid', desc: 'Przyłącze do sieci elektroenergetycznej – umożliwia wymianę energii. Zwiększa generowanie ViCoinów.' },
                { icon: '🧫', title: 'Domowe ogniwo paliwowe Vitovalor (2014)', desc: 'Z gazu ziemnego wytwarza prąd i ciepło bez tradycyjnego spalania ("zimna" reakcja utleniania wodoru).' },
                { icon: '🧪', title: 'Laboratorium R&D', desc: 'Jednorazowa inwestycja. Bardzo drogie, ale trwale zwiększa produkcję zasobów (+0.02 ☀️/💧/🌬️, +0.01 💰). Dostępne od początku gry.' },
              ];

              return (
                <div>
                  {(compendiumFilter === 'all' || compendiumFilter === 'heat') && (
                    <div>
                      {sectionTitle('Urządzenia grzewcze dla Twojego domu')}
                      <div style={{ display: 'grid', gap: 10 }}>
                        {heatItems.map((it, i) => <Card key={i} icon={it.icon} title={it.title} desc={it.desc} />)}
                      </div>
                    </div>
                  )}

                  {(compendiumFilter === 'all' || compendiumFilter === 'support') && (
                    <div style={{ marginTop: 16 }}>
                      {sectionTitle('Urządzenia wspierające')}
                      <div style={{ display: 'grid', gap: 10 }}>
                        {supportItems.map((it, i) => <Card key={i} icon={it.icon} title={it.title} desc={it.desc} />)}
                      </div>
                    </div>
                  )}

                  {(compendiumFilter === 'all' || compendiumFilter === 'relations') && (
                    <div style={{ marginTop: 16 }}>
                      {sectionTitle('Relacje i opinie frakcji')}
                      <div style={{ display: 'grid', gap: 10 }}>
                        <div style={{ padding: 12, borderRadius: 12, background: isDay ? '#f9fafb' : '#111827', border: isDay ? '1px solid #e5e7eb' : '1px solid #334155' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ fontWeight: 700 }}>Społeczność lokalna</div>
                            <span
                              onMouseEnter={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setRelTip({ left: r.left + r.width / 2, top: r.bottom + 8, text: relTipText('community') }); }}
                              onMouseLeave={() => setRelTip(null)}
                              onFocus={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setRelTip({ left: r.left + r.width / 2, top: r.bottom + 8, text: relTipText('community') }); }}
                              onBlur={() => setRelTip(null)}
                              tabIndex={0}
                              aria-label="Informacja o relacji: Społeczność lokalna"
                              style={{ marginLeft: 2, cursor: 'help' }}
                            >
                              <span style={{ fontSize: 16, color: isDay ? '#0ea5e9' : '#bae6fd', fontWeight: 700, verticalAlign: 'middle' }}>ℹ️</span>
                            </span>
                            <div style={{ marginLeft: 'auto', fontSize: 12, color: isDay ? '#64748b' : '#94a3b8' }}>{rel('community')}</div>
                          </div>
                          <div style={{ marginTop: 6 }}><Bar v={rel('community')} /></div>
                          <div style={{ fontSize: 13, color: isDay ? '#475569' : '#94a3b8', marginTop: 6 }}>
                            Wpływają: ogrody społeczne, czyste powietrze, decyzje pro‑ekologiczne.
                          </div>
                        </div>
                        <div style={{ padding: 12, borderRadius: 12, background: isDay ? '#f9fafb' : '#111827', border: isDay ? '1px solid #e5e7eb' : '1px solid #334155' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ fontWeight: 700 }}>Dostawcy</div>
                            <span
                              onMouseEnter={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setRelTip({ left: r.left + r.width / 2, top: r.bottom + 8, text: relTipText('suppliers') }); }}
                              onMouseLeave={() => setRelTip(null)}
                              onFocus={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setRelTip({ left: r.left + r.width / 2, top: r.bottom + 8, text: relTipText('suppliers') }); }}
                              onBlur={() => setRelTip(null)}
                              tabIndex={0}
                              aria-label="Informacja o relacji: Dostawcy"
                              style={{ marginLeft: 2, cursor: 'help' }}
                            >
                              <span style={{ fontSize: 16, color: isDay ? '#0ea5e9' : '#bae6fd', fontWeight: 700, verticalAlign: 'middle' }}>ℹ️</span>
                            </span>
                            <div style={{ marginLeft: 'auto', fontSize: 12, color: isDay ? '#64748b' : '#94a3b8' }}>{rel('suppliers')}</div>
                          </div>
                          <div style={{ marginTop: 6 }}><Bar v={rel('suppliers')} /></div>
                          <div style={{ fontSize: 13, color: isDay ? '#475569' : '#94a3b8', marginTop: 6 }}>
                            Wpływają: porozumienia handlowe, wspólne kampanie, niezależność.
                          </div>
                        </div>
                        {Object.keys(factions).filter(k => k !== 'community' && k !== 'suppliers').length > 0 && (
                          <div style={{ fontSize: 12, color: isDay ? '#64748b' : '#94a3b8' }}>
                            Inne frakcje: {Object.keys(factions).filter(k => k !== 'community' && k !== 'suppliers').map(k => `${k} (${rel(k)})`).join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {(compendiumFilter === 'all' || compendiumFilter === 'history') && (
                    <div style={{ marginTop: 16 }}>
                      {sectionTitle('Historia i kamienie milowe')} 
                      <div style={{ display: 'grid', gap: 10 }}>
                        {/* Eco‑reputation trend */}
                        {ecoRepHistory.length >= 2 && (
                          <div style={{ padding: 12, borderRadius: 12, background: isDay ? '#f9fafb' : '#111827', border: isDay ? '1px solid #e5e7eb' : '1px solid #334155' }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                              <div style={{ fontWeight: 700 }}>Trendy eko‑reputacji</div>
                              <div style={{ marginLeft: 'auto', fontSize: 12, color: isDay ? '#64748b' : '#94a3b8' }}>
                                Teraz: {ecoRep}/100 {ecoRepTrend !== 0 && (
                                  <span style={{ marginLeft: 6, color: ecoRepTrend > 0 ? (isDay ? '#166534' : '#86efac') : (isDay ? '#991b1b' : '#fecaca') }}>
                                    {ecoRepTrend > 0 ? '▲' : '▼'} {Math.abs(ecoRepTrend)}
                                  </span>
                                )}
                              </div>
                            </div>
                            {/* Sparkline */}
                            {(() => {
                              const w = 240, h = 48, pad = 2;
                              const data = ecoRepHistory.slice(-60); // ~5 min
                              const vs = data.map(d => d.v);
                              const vmin = Math.min(0, Math.min(...vs));
                              const vmax = Math.max(100, Math.max(...vs));
                              const toX = (i: number) => pad + (i * (w - pad * 2)) / Math.max(1, data.length - 1);
                              const toY = (v: number) => pad + (h - pad * 2) * (1 - (v - vmin) / Math.max(1, (vmax - vmin)));
                              const dAttr = data.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(p.v)}`).join(' ');
                              return (
                                <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="56" preserveAspectRatio="none" style={{ marginTop: 8 }}>
                                  <path d={dAttr} fill="none" stroke={isDay ? '#0ea5e9' : '#93c5fd'} strokeWidth="2" />
                                </svg>
                              );
                            })()}
                            <div style={{ fontSize: 12, color: isDay ? '#64748b' : '#94a3b8' }}>Ostatnie ~5 minut gry.</div>
                          </div>
                        )}
                        <Card icon="🔩" title="1917–1928: Stalowe kotły" desc="Trwalsze, szybciej się nagrzewają, mniejsze zużycie paliwa." />
                        <Card icon="🔥" title="1957: Triola" desc="Stalowy piec z podgrzewaczem – przełom wygody i bezpieczeństwa." />
                        <Card icon="🛢️" title="1965: Parola" desc="Niższe emisje i wysoka sprawność – krok ku czystości." />
                        <Card icon="🧪" title="1972: Stal nierdzewna" desc="Lepsza wymiana ciepła, łatwiejsze czyszczenie – podstawa kondensacji." />
                        <Card icon="🌀" title="1978: Pierwsza pompa ciepła" desc="Energia z otoczenia zmienia reguły gry." />
                        <Card icon="♨️" title="1978: Vitola niskotemperaturowa" desc="Efektywność dzięki pracy w niższych temperaturach." />
                        <Card icon="🔥💧" title="1989: Vitodens" desc="Kondensacja pary – wyższa sprawność, niższe emisje." />
                        <Card icon="🔋" title="XXI w.: Vitocal i OZE" desc="Nowoczesne pompy ciepła i integracja OZE w domu." />
                        {/* Story Decisions sub-section */}
                        <div style={{ height: 1, background: isDay ? '#e5e7eb' : '#334155', margin: '10px 0' }} />
                        {sectionTitle('Twoje decyzje fabularne')}
                        {storyDecisions.length === 0 ? (
                          <div style={{ fontSize: 13, color: isDay ? '#64748b' : '#94a3b8' }}>Brak zapisanych decyzji.</div>
                        ) : (
                          <div style={{ display: 'grid', gap: 8 }}>
                            {storyDecisions.slice(0, 12).map(d => (
                              <div key={d.id} style={{ padding: 10, borderRadius: 10, background: isDay ? '#f9fafb' : '#111827', border: isDay ? '1px solid #e5e7eb' : '1px solid #334155' }}>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                                  <div style={{ fontWeight: 700 }}>{d.eventTitle}</div>
                                  <div style={{ marginLeft: 'auto', fontSize: 12, color: isDay ? '#64748b' : '#94a3b8' }}>{new Date(d.ts).toLocaleTimeString()}</div>
                                </div>
                                <div style={{ fontSize: 13, color: isDay ? '#334155' : '#cbd5e1' }}>Wybrano: <span style={{ fontWeight: 700 }}>{d.choiceLabel}</span></div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
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

type IsoView = {
  scale: number;
  offset: { x: number; y: number };
  viewport: { w: number; h: number };
  contentW: number;
  contentH: number;
  tileW: number;
  tileH: number;
  baseX: number;
  baseY: number;
  size: number;
};

type IsoGridHandle = {
  centerWorld: (wx: number, wy: number) => void;
  centerHome: () => void;
  setScale: (s: number) => void;
};

const IsoGrid = React.forwardRef<IsoGridHandle, {
  tiles: IsoTileType[];
  homeTileId: string;
  onTileClick: (t: IsoTileType) => void;
  pendingItem: { key: string; name: string; icon: string } | null;
  lastPlacedKey: string | null;
  isPlaceable?: (t: IsoTileType) => boolean;
  weatherEvent: WeatherEvent;
  isDay: boolean;
  onViewChange?: (view: IsoView) => void;
}>(function IsoGrid({
  tiles, homeTileId, onTileClick, pendingItem, lastPlacedKey, isPlaceable, weatherEvent, isDay, onViewChange
}, ref) {
  const [hoverInfo, setHoverInfo] = useState<{ tile: IsoTileType; left: number; top: number; placeable: boolean } | null>(null);
  const tileW = 96, tileH = 48;
  const size = Math.sqrt(tiles.length);
  const baseX = (size - 1) * (tileW / 2);
  const baseY = 0;

  // Zoom & pan state (start slightly zoomed in for a larger visual map)
  const [scale, setScale] = useState(1.35);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const panRef = useRef<{ active: boolean; sx: number; sy: number; ox: number; oy: number }>({ active: false, sx: 0, sy: 0, ox: 0, oy: 0 });
  const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
  const contentW = size * tileW;
  const contentH = size * tileH;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ w: contentW, h: contentH });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const resize = () => setViewport({ w: el.clientWidth, h: el.clientHeight });
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fire an initial view update so parent can render the minimap immediately
  useEffect(() => {
    onViewChange?.({
      scale,
      offset,
      viewport,
      contentW,
      contentH,
      tileW,
      tileH,
      baseX,
      baseY,
      size,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Notify parent about view changes
  useEffect(() => {
    onViewChange?.({
      scale,
      offset,
      viewport,
      contentW,
      contentH,
      tileW,
      tileH,
      baseX,
      baseY,
      size,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, offset, viewport]);

  const onWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    // Zoom with wheel; prevent page scroll while over the map
    e.preventDefault();
    const dir = e.deltaY > 0 ? -1 : 1;
  const next = clamp(scale * (dir > 0 ? 1.12 : 0.89), 0.6, 2.25);
    setScale(next);
  };

  const startPan: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!e.altKey || e.button !== 0) return; // Alt + left drag to pan
    e.preventDefault();
    panRef.current = { active: true, sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y };
    const onMove = (ev: MouseEvent) => {
      if (!panRef.current.active) return;
      const dx = ev.clientX - panRef.current.sx;
      const dy = ev.clientY - panRef.current.sy;
      setOffset({ x: panRef.current.ox + dx, y: panRef.current.oy + dy });
    };
    const onUp = () => {
      panRef.current.active = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const centerHome = useCallback(() => {
    const home = tiles.find(t => t.id === homeTileId);
    if (!home) return;
    const left = (home.x - home.y) * (tileW / 2) + baseX + tileW / 2;
    const top = (home.x + home.y) * (tileH / 2) + baseY + tileH / 2;
    setOffset({ x: (viewport.w / 2) - left * scale, y: (viewport.h / 2) - top * scale });
  }, [tiles, homeTileId, tileW, tileH, baseX, baseY, viewport.w, viewport.h, scale]);

  // Center home and enforce the preferred zoom level
  const centerHomeZoomed = useCallback(() => {
    const preferred = 1.35;
    const home = tiles.find(t => t.id === homeTileId);
    if (!home) { setScale(preferred); return; }
    const left = (home.x - home.y) * (tileW / 2) + baseX + tileW / 2;
    const top = (home.x + home.y) * (tileH / 2) + baseY + tileH / 2;
    setScale(preferred);
    setOffset({ x: (viewport.w / 2) - left * preferred, y: (viewport.h / 2) - top * preferred });
  }, [tiles, homeTileId, tileW, tileH, baseX, baseY, viewport.w, viewport.h]);

  // Imperative API for parent (recentering on minimap click)
  useImperativeHandle(ref, () => ({
    centerWorld: (wx: number, wy: number) => {
      setOffset({ x: (viewport.w / 2) - wx * scale, y: (viewport.h / 2) - wy * scale });
    },
    centerHome,
    setScale: (s: number) => setScale(s),
  }), [viewport.w, viewport.h, scale, centerHome]);


  // Center map to home after first real viewport measurement
  const didCenterRef = useRef(false);
  useEffect(() => {
    if (didCenterRef.current) return;
    // Wait until ResizeObserver measured the actual container size (different from initial content size)
    if (viewport.w === contentW && viewport.h === contentH) return;
    try {
      centerHome();
      didCenterRef.current = true;
    } catch {
      // ignore
    }
  }, [centerHome, viewport.w, viewport.h, contentW, contentH]);

  return (
    <div
      ref={containerRef}
      onWheel={onWheel}
      onMouseDown={startPan}
      style={{ position: "relative", width: '100%', height: '60vh', minHeight: 360, margin: "8px auto 0", overflow: 'hidden', cursor: panRef.current.active ? 'grabbing' : undefined, userSelect: panRef.current.active ? 'none' : undefined, background: 'transparent' }}
    >
      {/* Controls overlay */}
  <div style={{ position: 'absolute', right: 8, top: 8, zIndex: 60, display: 'flex', gap: 6 }}>
        <button
          onClick={() => setScale(s => clamp(s * 0.9, 0.75, 1.5))}
          title="Pomniejsz"
          style={{ padding: '4px 8px', borderRadius: 6, border: isDay ? '1px solid #e5e7eb' : '1px solid #334155', background: isDay ? '#fff' : '#111827', color: isDay ? '#0f172a' : '#e5e7eb', cursor: 'pointer' }}
        >−</button>
        <button
          onClick={() => setScale(s => clamp(s * 1.1, 0.75, 1.5))}
          title="Powiększ"
          style={{ padding: '4px 8px', borderRadius: 6, border: isDay ? '1px solid #e5e7eb' : '1px solid #334155', background: isDay ? '#fff' : '#111827', color: isDay ? '#0f172a' : '#e5e7eb', cursor: 'pointer' }}
        >+</button>
        <button
          onClick={centerHomeZoomed}
          title="Wyśrodkuj dom"
          style={{ padding: '4px 8px', borderRadius: 6, border: isDay ? '1px solid #e5e7eb' : '1px solid #334155', background: isDay ? '#fff' : '#111827', color: isDay ? '#0f172a' : '#e5e7eb', cursor: 'pointer' }}
        >🎯</button>
      </div>

      {/* Transformed content wrapper (tiles + weather + guides) */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: contentW, height: contentH, transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: '0 0' }}>
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
  </div>
      {/* Hover card */}
      {hoverInfo && (
        <div
          style={{
            position: 'absolute',
    left: offset.x + (hoverInfo.left + tileW / 2) * scale,
    top: offset.y + (hoverInfo.top - 8) * scale,
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
              <span style={{ display: 'inline-flex', flexDirection: 'column' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14 }}>{icon}</span>
                  <span className="font-medium font-sans">{text}</span>
                </span>
                {pendingItem ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 11, color: isDay ? '#64748b' : '#94a3b8' }}>
                    <span style={{ fontSize: 12 }}>⎋</span>
                    <span className="font-sans">Esc: anuluj</span>
                  </span>
                ) : null}
              </span>
            );
          })()}
        </div>
      )}

  {/* Minimap moved to parent section */}
    </div>
  );
});

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
      onClick={(e) => { if ((e as React.MouseEvent).altKey) return; onClick(); }}
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