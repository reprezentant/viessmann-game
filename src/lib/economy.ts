// Shared economy helpers: formatting, dynamic cost, affordability, rate text
import type { ResKey } from '../types';

export type Cost = Partial<Record<ResKey, number>>;

export const fmt = (n: number): string => {
  if (n === 0) return '0';
  if (Math.abs(n) < 0.01) return n.toFixed(3);
  if (Math.abs(n) < 0.1) return n.toFixed(2);
  return n % 1 === 0 ? n.toString() : n.toFixed(1);
};

export const canAfford = (resources: Record<ResKey, number>, cost: Cost): boolean =>
  Object.entries(cost).every(([k, v]) => resources[k as ResKey] >= (v ?? 0));

export const discountedCost = (cost: Cost, discountPct: number): Cost => {
  if (!discountPct) return cost;
  const out: Cost = {};
  for (const [k, v] of Object.entries(cost)) if (typeof v === 'number') out[k as ResKey] = Math.ceil(v * (1 - discountPct / 100));
  return out;
};

export const multiplyCost = (cost: Cost, factor: number): Cost => {
  const out: Cost = {};
  for (const [k, v] of Object.entries(cost)) if (typeof v === 'number') out[k as ResKey] = Math.ceil(v * factor);
  return out;
};

export const rateText = (k: ResKey, effectiveRates: Record<ResKey, number>): string => `+${fmt(effectiveRates[k])}/s`;

// Dynamic pricing policy for specific items.
// Call with current owned counts and base cost already discounted.
export const dynamicCost = (
  itemKey: string,
  baseCost: Cost,
  owned: Partial<Record<string, number>>
): Cost => {
  if (itemKey === 'forest') {
    const count = owned.forest ?? 0;
    const bump = 8 * count;
    return {
      ...baseCost,
      sun: (baseCost.sun ?? 0) + bump,
      water: (baseCost.water ?? 0) + bump,
    };
  }
  if (itemKey === 'solar') {
    const count = owned.solar ?? 0;
    const factor = Math.pow(1.15, count);
    return multiplyCost(baseCost, factor);
  }
  if (itemKey === 'echarger') {
    const count = owned.echarger ?? 0;
    const factor = Math.pow(1.18, count);
    return multiplyCost(baseCost, factor);
  }
  // No dynamic scaling for 'lab' – single purchase and fixed cost
  return baseCost;
};
