// Pollution-related helpers and constants
export type SeasonType = 'spring' | 'summer' | 'autumn' | 'winter';

export const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));

export const housePollutionFor = (k: string | null | undefined): number => {
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

export const seasonPollutionFor = (t: SeasonType): number => {
  switch (t) {
    case 'spring': return -0.01;
    case 'summer': return -0.02;
    case 'autumn': return 0.0;
    case 'winter': return +0.05;
  }
};
