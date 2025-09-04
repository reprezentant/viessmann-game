// Lightweight story system: types and sample events (PL)
export type StoryContext = {
  elapsed: number; // seconds
  pollution: number;
  hasCoal: boolean;
  renewablesUnlocked: boolean;
  season: string;
};

export type StoryChoice = {
  id: string;
  label: string;
  // Called by game integration with an API adapter
  apply: (api: StoryApi) => void;
};

export type StoryEvent = {
  id: string;
  title: string;
  text: string;
  once?: boolean; // default true
  condition: (ctx: StoryContext) => boolean;
  choices: StoryChoice[];
};

export type StoryApi = {
  // Small set of generic effects to avoid deep coupling
  grantCoins: (amount: number, log?: string) => void;
  addPollutionInstant: (delta: number, log?: string) => void;
  setGlobalDiscount: (pct: number, seconds: number, label?: string) => void;
  toast: (icon: string, text: string) => void;
  log: (title: string, description: string, icon?: string) => void;
  unlockRenewables?: () => void;
};

export function getSampleEvents(): StoryEvent[] {
  return [
    {
      id: 'grant-boiler-exchange',
      title: 'Program wymiany kotłów',
      text:
        'Gmina rusza z dopłatami do bardziej ekologicznych źródeł ciepła. Przez ograniczony czas możesz skorzystać z programu i taniej modernizować instalację.',
      once: true,
      condition: (ctx) => ctx.hasCoal && ctx.elapsed > 30,
      choices: [
        {
          id: 'accept',
          label: 'Skorzystaj z dopłaty (−20% ceny przez 2 min)',
          apply: (api) => {
            api.setGlobalDiscount(0.2, 120, 'Dotacja gminna');
            api.toast('🎯', 'Aktywowano dotację: −20% cen przez 2 minuty.');
            api.log('Dotacja aktywna', 'Ceny obniżone o 20% na ograniczony czas.', '🎯');
          },
        },
        {
          id: 'decline',
          label: 'Zrezygnuj (zachowaj niezależność)',
          apply: (api) => {
            api.grantCoins(10, 'Premia za niezależność');
            api.toast('💰', 'Otrzymano 10 ViCoins za niezależność.');
          },
        },
      ],
    },
    {
      id: 'summer-solar-push',
      title: 'Solarne lato',
      text:
        'Wyjątkowo słoneczna prognoza na najbliższe dni. To świetny moment, by zainwestować w OZE i obniżyć rachunki.',
      once: true,
      condition: (ctx) => ctx.renewablesUnlocked && ctx.season === 'summer' && ctx.elapsed > 60,
      choices: [
        {
          id: 'promo',
          label: 'Kampania OZE (−15% cen przez 90 s)',
          apply: (api) => {
            api.setGlobalDiscount(0.15, 90, 'Kampania OZE');
            api.toast('☀️', 'Kampania OZE: −15% cen przez 90 sekund.');
          },
        },
        {
          id: 'awareness',
          label: 'Edukacja mieszkańców (−5 smogu)',
          apply: (api) => {
            api.addPollutionInstant(-5, 'Edukacja mieszkańców');
            api.toast('🌿', 'Lokalne działania ograniczyły smog (−5).');
          },
        },
      ],
    },
  ];
}
