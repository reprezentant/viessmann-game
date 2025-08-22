import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Tile, EntityInstance, GameItem, ResourceState, ResKey, OwnedDevices, EntityType } from '../types';

export function useGameLogic() {
  // Game state
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [resources, setResources] = useState<ResourceState>({ sun: 0, water: 0, wind: 0, coins: 10 });
  const [baseRates, setBaseRates] = useState<Record<ResKey, number>>({ sun: 0, water: 0, wind: 0, coins: 0 });
  const [owned, setOwned] = useState<OwnedDevices>({});
  const [pollution, setPollution] = useState(0);
  const [pollutionRate, setPollutionRate] = useState(0);
  const [phase, setPhase] = useState(0);
  const [renewablesUnlocked, setRenewablesUnlocked] = useState(false);
  const [pendingPlacement, setPendingPlacement] = useState<GameItem | null>(null);
  const [lastPlacedKey, setLastPlacedKey] = useState<string | null>(null);

  // Constants
  const GRID_SIZE = 7;
  const CENTER = Math.floor(GRID_SIZE / 2);
  const homeTileId = `${CENTER},${CENTER}`;

  // Initialize grid
  useEffect(() => {
    const list: Tile[] = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      for (let y = 0; y < GRID_SIZE; y++) {
        list.push({ 
          id: `${x},${y}`, 
          x, 
          y, 
          entity: null, 
          isHome: x === CENTER && y === CENTER 
        });
      }
    }
    setTiles(list);
  }, [CENTER, GRID_SIZE]);

  // Game items
  const deviceItems: GameItem[] = [
    { key: "coal", name: "Kocioł węglowy", icon: "🔥", price: 0, description: "Podstawowy system grzewczy. Zwiększa zanieczyszczenie." },
    { key: "pellet", name: "Kocioł na pellet", icon: "🌾", price: 15, description: "Ekologiczniejszy system. Odblokowuje odnawialne źródła energii." },
    { key: "gas", name: "Kocioł gazowy", icon: "💨", price: 25, description: "Nowoczesny i wydajny system grzewczy." },
  ];

  const productionItems: GameItem[] = [
    { key: "floor", name: "Ogrzewanie podłogowe", icon: "🔲", price: 10, description: "Zwiększa efektywność systemu grzewczego." },
    { key: "thermostat", name: "Inteligentny termostat", icon: "🌡️", price: 8, description: "Optymalizuje zużycie energii." },
    { key: "heatpump", name: "Pompa ciepła", icon: "♨️", price: 30, description: "Wysokowydajny system wykorzystujący energię odnawialną." },
    { key: "inverter", name: "Inwerter", icon: "🔌", price: 12, description: "Konwertuje energię słoneczną na elektryczność." },
    { key: "grid", name: "Sieć energetyczna", icon: "⚡", price: 18, description: "Łączy systemy energetyczne." },
    { key: "solar", name: "Panel słoneczny", icon: "☀️", price: 20, description: "Generuje energię słoneczną." },
    { key: "echarger", name: "Ładowarka EV", icon: "🔋", price: 35, description: "Ładuje pojazdy elektryczne." },
    { key: "forest", name: "Las", icon: "🌲", price: 25, description: "Redukuje zanieczyszczenie środowiska." },
  ];

  // Calculated values
  const isDay = phase < 12;
  const phasePct = (phase % 12) / 12 * 100;
  const effectiveRates = useMemo<Record<ResKey, number>>(() => ({
    sun: baseRates.sun * (isDay ? 1 : 0),
    water: baseRates.water,
    wind: baseRates.wind * (isDay ? 0.7 : 1.3),
    coins: baseRates.coins,
  }), [baseRates, isDay]);

  // Helper functions
  const addPollutionRate = useCallback((delta: number) => {
    setPollutionRate(prev => Math.max(0, prev + delta));
  }, []);

  const isSinglePurchase = (k: EntityType) => !["solar", "echarger", "forest"].includes(k);

  // Purchase logic
  const purchase = useCallback((item: GameItem) => {
    if (resources.coins < item.price) return;
    setResources(r => ({ ...r, coins: r.coins - item.price }));

    if (isSinglePurchase(item.key)) {
      setPendingPlacement(item);
      return;
    }

    // Multi-purchase logic for solar, echarger, forest
    if (item.key === "solar") {
      const cost = item.price + (owned.solar ?? 0) * 5;
      if (resources.coins < cost) return;
      setResources(r => ({ ...r, coins: r.coins - cost }));
      setOwned(o => ({ ...o, solar: (o.solar ?? 0) + 1 }));
      setBaseRates(r => ({ ...r, sun: r.sun + 0.3 }));
    }

    if (item.key === "echarger") {
      const cost = item.price + (owned.echarger ?? 0) * 10;
      if (resources.coins < cost) return;
      setResources(r => ({ ...r, coins: r.coins - cost }));
      setOwned(o => ({ ...o, echarger: (o.echarger ?? 0) + 1 }));
      // EV charging provides periodic coin bonus
      const timer = setInterval(() => {
        setResources(r => ({ ...r, coins: r.coins + 5 }));
      }, 60000); // every minute
      setTimeout(() => clearInterval(timer), 300000); // stop after 5 minutes
    }

    if (item.key === "forest") {
      const cost = item.price + (owned.forest ?? 0) * 8;
      if (resources.coins < cost) return;
      setResources(r => ({ ...r, coins: r.coins - cost }));
      setOwned(o => ({ ...o, forest: (o.forest ?? 0) + 1 }));
      addPollutionRate(-0.15);
    }

    if (item.key === "floor" || item.key === "thermostat") {
      setOwned(o => ({ ...o, [item.key]: (o[item.key] ?? 0) + 1 }));
      setBaseRates(r => ({ ...r, coins: r.coins + 0.1 }));
    }

    if (item.key === "heatpump") {
      setOwned(o => ({ ...o, heatpump: (o.heatpump ?? 0) + 1 }));
      setBaseRates(r => ({ 
        ...r, 
        coins: r.coins + 0.5, 
        sun: r.sun + 0.5, 
        wind: r.wind + 0.3, 
        water: r.water + 0.2 
      }));
    }

    if (item.key === "inverter" || item.key === "grid") {
      setOwned(o => ({ ...o, [item.key]: (o[item.key] ?? 0) + 1 }));
      setBaseRates(r => ({ ...r, coins: r.coins + 0.2 }));
    }
  }, [resources.coins, owned, addPollutionRate]);

  const placeOnTile = useCallback((tile: Tile) => {
    if (!pendingPlacement) return;

    if (pendingPlacement.key === "coal") {
      if (tile.id !== homeTileId || tile.entity) return;
      const instance: EntityInstance = { type: "coal", label: pendingPlacement.name, icon: pendingPlacement.icon };
      setTiles(ts => ts.map(t => t.id === tile.id ? { ...t, entity: instance } : t));
      addPollutionRate(+0.2);
      setOwned(o => ({ ...o, coal: (o.coal ?? 0) + 1 }));
      setPendingPlacement(null);
      setLastPlacedKey(tile.id);
      return;
    }

    if (pendingPlacement.key === "pellet") {
      if (tile.id !== homeTileId) return;
      const instance: EntityInstance = { type: "pellet", label: pendingPlacement.name, icon: pendingPlacement.icon };
      setTiles(ts => ts.map(t => t.id === tile.id ? { ...t, entity: instance } : t));
      setOwned(o => ({ ...o, coal: 0, pellet: (o.pellet ?? 0) + 1 }));
      addPollutionRate(-0.1);
      setRenewablesUnlocked(true);
      setBaseRates(r => ({ 
        ...r, 
        sun: Math.max(r.sun, 1 / 12), 
        wind: Math.max(r.wind, 1 / 16), 
        water: Math.max(r.water, 1 / 18), 
        coins: 0.03 
      }));
      setPendingPlacement(null);
      setLastPlacedKey(tile.id);
      return;
    }

    if (pendingPlacement.key === "gas") {
      if (tile.id !== homeTileId) return;
      const instance: EntityInstance = { type: "gas", label: pendingPlacement.name, icon: pendingPlacement.icon };
      setTiles(ts => ts.map(t => t.id === tile.id ? { ...t, entity: instance } : t));
      setOwned(o => ({ ...o, pellet: 0, gas: (o.gas ?? 0) + 1 }));
      addPollutionRate(-0.1);
      setBaseRates(r => ({ ...r, coins: Math.min(r.coins, 0.03) }));
      setPendingPlacement(null);
      setLastPlacedKey(tile.id);
      return;
    }

    if (!tile.isHome && tile.entity) return;
    if (tile.isHome && tiles.find(t => t.id === homeTileId)?.entity) return;

    const instance: EntityInstance = { 
      type: pendingPlacement.key, 
      label: pendingPlacement.name, 
      icon: pendingPlacement.icon 
    };
    setTiles(ts => ts.map(t => t.id === tile.id ? { ...t, entity: instance } : t));
    setPendingPlacement(null);
    setLastPlacedKey(tile.id);
  }, [pendingPlacement, homeTileId, tiles, addPollutionRate]);

  // Game loop effects
  useEffect(() => {
    if (!lastPlacedKey) return;
    const t = setTimeout(() => setLastPlacedKey(null), 400);
    return () => clearTimeout(t);
  }, [lastPlacedKey]);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhase(p => (p + 1) % 24);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setResources(r => ({
        sun: Math.max(0, r.sun + effectiveRates.sun),
        water: Math.max(0, r.water + effectiveRates.water),
        wind: Math.max(0, r.wind + effectiveRates.wind),
        coins: Math.max(0, r.coins + effectiveRates.coins),
      }));
      setPollution(p => Math.max(0, p + pollutionRate));
    }, 1000);
    return () => clearInterval(interval);
  }, [effectiveRates, pollutionRate]);

  return {
    // State
    tiles,
    resources,
    pollution,
    phase,
    renewablesUnlocked,
    pendingPlacement,
    lastPlacedKey,
    homeTileId,
    owned,
    
    // Computed
    isDay,
    phasePct,
    effectiveRates,
    
    // Items
    deviceItems,
    productionItems,
    
    // Actions
    placeOnTile,
    setPendingPlacement,
    purchase,
  };
}
