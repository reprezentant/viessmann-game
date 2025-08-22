export type EntityType =
  | "coal" | "pellet" | "gas" | "floor" | "thermostat" | "heatpump"
  | "inverter" | "grid" | "solar" | "echarger" | "forest";

export type ResKey = "sun" | "water" | "wind" | "coins";

export interface EntityInstance {
  type: EntityType;
  label: string;
  icon: string;
}

export interface Tile {
  id: string;
  x: number;
  y: number;
  entity?: EntityInstance | null;
  isHome?: boolean;
}

export interface ResourceState {
  sun: number;
  water: number;
  wind: number;
  coins: number;
}

export interface GameItem {
  key: EntityType;
  name: string;
  icon: string;
  price: number;
  description: string;
}

export interface OwnedDevices {
  [key: string]: number;
}
