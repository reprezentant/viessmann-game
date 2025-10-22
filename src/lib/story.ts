// Lightweight story system: types and sample events (PL)
export type StoryContext = {
  elapsed: number; // seconds
  pollution: number;
  hasCoal: boolean;
  renewablesUnlocked: boolean;
  season: string;
  ecoRep?: number; // 0-100 optional reputation (new)
  forests?: number; // number of forests placed
  flags?: Record<string, boolean>; // world state flags for arcs
  factions?: Record<string, number>; // opinions: -100..100
  // current resources snapshot (optional)
  resources?: { sun: number; water: number; wind: number; coins: number };
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
  // optional narrative metadata
  arc?: string; // grouping for story arcs
  prereqFlags?: string[]; // required flags to be true
  cooldownSec?: number; // cooldown after firing (even if once=false)
  weight?: number; // relative weight when multiple are eligible
};

export type StoryApi = {
  // Small set of generic effects to avoid deep coupling
  grantCoins: (amount: number, log?: string) => void;
  grantResources?: (delta: Partial<{ sun: number; water: number; wind: number; coins: number }>) => void;
  addPollutionInstant: (delta: number, log?: string) => void;
  setGlobalDiscount: (pct: number, seconds: number, label?: string) => void;
  toast: (icon: string, text: string) => void;
  log: (title: string, description: string, icon?: string) => void;
  unlockRenewables?: () => void;
  // narrative state helpers
  setFlag?: (key: string, value: boolean) => void;
  adjustFaction?: (name: string, delta: number) => void;
  setEventCooldown?: (eventId: string, seconds: number) => void;
};

export function getSampleEvents(): StoryEvent[] {
  return [
    // Emergency aid when resources are low
    {
      id: 'aid-package',
      title: 'Paczka pomocowa',
      text:
        'Lokalni partnerzy oferują awaryjne wsparcie. Wybierz, czego najbardziej potrzebujesz.',
      once: false,
      cooldownSec: 90,
      condition: (ctx) => {
        const r = ctx.resources;
        if (!r) return false;
        const lowAny = r.sun < 6 || r.water < 6 || r.wind < 6;
        const total = r.sun + r.water + r.wind;
        return ctx.elapsed > 45 && lowAny && total < 24; // very low reserves
      },
      choices: [
        {
          id: 'aid-sun',
          label: 'Zestaw testowych paneli (+12 ☀️)',
          apply: (api) => {
            api.grantResources?.({ sun: 12 });
            api.toast('☀️', 'Otrzymano awaryjne panele: +12 ☀️');
            api.adjustFaction?.('suppliers', +3);
          },
        },
        {
          id: 'aid-water',
          label: 'Awaryjne zbiorniki (+12 💧)',
          apply: (api) => {
            api.grantResources?.({ water: 12 });
            api.toast('💧', 'Dostawa zbiorników: +12 💧');
          },
        },
        {
          id: 'aid-wind',
          label: 'Serwisowy wiatrak (+12 🌬️)',
          apply: (api) => {
            api.grantResources?.({ wind: 12 });
            api.toast('🌬️', 'Tymczasowy wiatrak: +12 🌬️');
          },
        },
        {
          id: 'aid-coins',
          label: 'Bon budżetowy (+10 ViCoins)',
          apply: (api) => {
            api.grantCoins(10, 'Bon budżetowy');
            api.toast('ViCoin', 'Otrzymano 10 ViCoins.');
          },
        },
      ],
    },
    // Community arc (multi-step, faction effects)
    {
      id: 'community-garden-proposal',
      title: 'Ogród społeczny',
      text:
        'Mieszkańcy proponują utworzenie ogrodu społecznego przy lesie. To wzmocni lokalną więź i świadomość ekologiczną.',
      once: true,
      arc: 'community',
      cooldownSec: 120,
      condition: (ctx) => (ctx.ecoRep ?? 0) >= 60 && (ctx.forests ?? 0) >= 2 && (ctx.flags?.['community_garden'] !== true),
      choices: [
        {
          id: 'support-garden',
          label: 'Wspieraj inicjatywę (−4 smogu, +opinia społeczność)',
          apply: (api) => {
            api.addPollutionInstant(-4, 'Ogród społeczny');
            api.adjustFaction?.('community', +10);
            api.setFlag?.('community_garden', true);
            api.toast('🌿', 'Powstaje ogród społeczny.');
          },
        },
        {
          id: 'no-budget',
          label: 'Nie ma budżetu (+8 ViCoins, −opinia społeczność)',
          apply: (api) => {
            api.grantCoins(8, 'Oszczędności');
            api.adjustFaction?.('community', -6);
            api.toast('ViCoin', 'Odmowa wsparcia ogrodu.');
          },
        },
      ],
    },
    // High eco reputation reward
    {
      id: 'eco-champion-award',
      title: 'Nagroda „Zielony Lider”',
      text:
        'Twoje działania proekologiczne zostały wyróżnione. Możesz przeznaczyć nagrodę na promocję modernizacji albo na budżet.',
      once: true,
      condition: (ctx) => (ctx.ecoRep ?? 0) >= 75 && ctx.renewablesUnlocked && ctx.elapsed > 120,
      choices: [
        {
          id: 'award-promo',
          label: 'Promocja modernizacji (−18% cen przez 75 s)',
          apply: (api) => {
            api.setGlobalDiscount(18, 75, 'Zielony Lider');
            api.toast('🌿', 'Zielony Lider: −18% cen przez 75 sekund.');
          },
        },
        {
          id: 'award-coins',
          label: 'Przeznacz na budżet (+20 ViCoins)',
          apply: (api) => {
            api.grantCoins(20, 'Nagroda Zielony Lider');
            api.toast('ViCoin', 'Nagroda przyznana: +20 ViCoins.');
          },
        },
      ],
    },
    // Supplier relation (faction)
    {
      id: 'supplier-mou',
      title: 'Porozumienie z dostawcą',
      text:
        'Dostawca proponuje memorandum o współpracy. W zamian za promocję marki – lepsze warunki na modernizacje.',
      once: true,
      arc: 'suppliers',
      cooldownSec: 90,
      condition: (ctx) => (ctx.ecoRep ?? 0) >= 45 && ctx.elapsed > 70 && (ctx.factions?.['suppliers'] ?? 0) >= -20,
      choices: [
        {
          id: 'sign',
          label: 'Podpisz (−10% cen przez 75 s, +opinia dostawcy)',
          apply: (api) => {
            api.setGlobalDiscount(10, 75, 'Współpraca z dostawcą');
            api.adjustFaction?.('suppliers', +8);
            api.setFlag?.('supplier_mou', true);
            api.toast('📜', 'Podpisano porozumienie z dostawcą.');
          },
        },
        {
          id: 'decline',
          label: 'Odrzuć (+10 ViCoins, −opinia dostawcy)',
          apply: (api) => {
            api.grantCoins(10, 'Niezależność');
            api.adjustFaction?.('suppliers', -8);
            api.toast('⚖️', 'Utrzymano niezależność.');
          },
        },
      ],
    },
    // Follow-up obligation if MoU was signed
    {
      id: 'supplier-mou-commitment',
      title: 'Zobowiązanie z porozumienia',
      text:
        'Partner prosi o wsparcie kampanii według warunków porozumienia. Możesz dołożyć środki teraz lub zaryzykować ochłodzenie relacji.',
      once: true,
      arc: 'suppliers',
      cooldownSec: 120,
      condition: (ctx) => ctx.flags?.['supplier_mou'] === true && ctx.elapsed > 120,
      choices: [
        {
          id: 'commit-pay',
          label: 'Wesprzyj kampanię (−12 ViCoins, +opinia dostawcy)',
          apply: (api) => {
            api.grantCoins(-12, 'Wsparcie kampanii');
            api.adjustFaction?.('suppliers', +6);
            api.toast('🤝', 'Wywiązano się z zobowiązania (−12 ViCoins).');
          },
        },
        {
          id: 'commit-defer',
          label: 'Odraczamy (−opinia dostawcy, +8% ceny przez 45 s)',
          apply: (api) => {
            api.adjustFaction?.('suppliers', -10);
            api.setGlobalDiscount(-8, 45, 'Opóźniona realizacja');
            api.toast('⏳', 'Opóźnienie pogarsza warunki chwilowo (+8% cen).');
          },
        },
      ],
    },
    // Community backlash when opinion is low
    {
      id: 'community-protest',
      title: 'Głos niezadowolenia mieszkańców',
      text:
        'Część mieszkańców krytykuje dotychczasowe decyzje. Możesz zorganizować konsultacje lub zignorować głosy niezadowolenia.',
      once: true,
      arc: 'community',
      cooldownSec: 120,
      condition: (ctx) => (ctx.factions?.['community'] ?? 0) <= -25 && ctx.elapsed > 90,
      choices: [
        {
          id: 'hold-consult',
          label: 'Konsultacje i drobne usprawnienia (−8 ViCoins, −3 smogu)',
          apply: (api) => {
            api.grantCoins(-8, 'Konsultacje społeczne');
            api.addPollutionInstant(-3, 'Usprawnienia po konsultacjach');
            api.adjustFaction?.('community', +8);
          },
        },
        {
          id: 'ignore',
          label: 'Zignoruj (+5 ViCoins teraz, +6 smogu)',
          apply: (api) => {
            api.grantCoins(5, 'Oszczędności krótkoterminowe');
            api.addPollutionInstant(+6, 'Zaniedbania');
            api.adjustFaction?.('community', -6);
          },
        },
      ],
    },
    // Press critique when ecoRep is low: temporary price malus
    {
      id: 'press-critique',
      title: 'Krytyka prasowa',
      text:
        'Media zwracają uwagę na niską jakość powietrza i brak działań. Sklepy podnoszą ceny części i usług.',
      once: true,
      cooldownSec: 90,
      condition: (ctx) => (ctx.ecoRep ?? 0) < 30 && ctx.elapsed > 80,
      choices: [
        {
          id: 'accept',
          label: 'Pracujmy dalej (+8% ceny przez 45 s)',
          apply: (api) => {
            api.setGlobalDiscount(-8, 45, 'Krytyka prasowa');
            api.toast('📰', 'Czasowo wyższe ceny (+8%).');
          },
        },
        {
          id: 'counter',
          label: 'Kontrkampania (−10 ViCoins, −4 smogu)',
          apply: (api) => {
            api.grantCoins(-10, 'Kontrkampania PR');
            api.addPollutionInstant(-4, 'Szybkie działania naprawcze');
          },
        },
      ],
    },
    // Supplier delays when relations are poor
    {
      id: 'supplier-delay',
      title: 'Opóźnienia dostaw',
      text:
        'Dostawcy sygnalizują problemy logistyczne. Gorsze relacje nie pomagają. Masz dwie opcje.',
      once: true,
      cooldownSec: 90,
      condition: (ctx) => (ctx.factions?.['suppliers'] ?? 0) < -20 && ctx.elapsed > 100,
      choices: [
        {
          id: 'pay-expedite',
          label: 'Dopłać za przyspieszenie (−10 ViCoins)',
          apply: (api) => {
            api.grantCoins(-10, 'Przyspieszenie dostaw');
          },
        },
        {
          id: 'wait-longer',
          label: 'Przeczekaj (−6% cen przez 30 s później)',
          apply: (api) => {
            // Modelujemy jako drobny, opóźniony rabat: ustawiamy krótki cooldown i rabat teraz,
            // bo nie mamy zegara do opóźniania – efekt: mała kompensacja po stratach czasu.
            api.setGlobalDiscount(6, 30, 'Kompensacja opóźnień');
          },
        },
      ],
    },
    // Mid eco reputation cooperation
    {
      id: 'municipal-partnership',
      title: 'Współpraca z gminą',
      text:
        'Gmina proponuje współpracę przy kampanii modernizacji. Możesz postawić na edukację lub uzyskać współfinansowanie modernizacji.',
      once: true,
      condition: (ctx) => (ctx.ecoRep ?? 0) >= 40 && (ctx.ecoRep ?? 0) < 75 && ctx.elapsed > 80,
      choices: [
        {
          id: 'education',
          label: 'Edukacja mieszkańców (−6 smogu)',
          apply: (api) => {
            api.addPollutionInstant(-6, 'Edukacja mieszkańców');
            api.toast('📘', 'Kampania edukacyjna ograniczyła smog (−6).');
          },
        },
        {
          id: 'cofund',
          label: 'Współfinansowanie (−12% cen przez 60 s)',
          apply: (api) => {
            api.setGlobalDiscount(12, 60, 'Współpraca z gminą');
            api.toast('🤝', 'Współfinansowanie: −12% cen przez 60 sekund.');
          },
        },
      ],
    },
    // Low eco reputation corrective plan
    {
      id: 'compliance-plan',
      title: 'Plan naprawczy',
      text:
        'Wysoki poziom zanieczyszczeń zwraca uwagę urzędników. Proponują plan naprawczy lub możesz odłożyć działania, ryzykując pogorszenie jakości powietrza.',
      once: true,
      condition: (ctx) => (ctx.ecoRep ?? 0) < 30 && ctx.pollution >= 50 && ctx.elapsed > 70,
      choices: [
        {
          id: 'accept-plan',
          label: 'Wdrażamy plan (−8 smogu, −8% cen przez 45 s)',
          apply: (api) => {
            api.addPollutionInstant(-8, 'Plan naprawczy');
            api.setGlobalDiscount(8, 45, 'Plan naprawczy');
            api.toast('🧹', 'Plan naprawczy: −8 smogu, −8% cen (45 s).');
          },
        },
        {
          id: 'defer-actions',
          label: 'Odłóż działania (+10 ViCoins, +3 smogu)',
          apply: (api) => {
            api.grantCoins(10, 'Oszczędności krótkoterminowe');
            api.addPollutionInstant(+3, 'Odłożono działania');
            api.toast('⏳', 'Działania odłożone: +10 ViCoins, +3 smogu.');
          },
        },
      ],
    },
    {
      id: 'winter-prep-supplies',
      title: 'Zapas przed zimą',
      text:
        'Mróz tuż tuż. Możesz zabezpieczyć dostawy i wynegocjować rabat na modernizacje albo zaryzykować i liczyć na oszczędności teraz.',
      once: true,
      condition: (ctx) => ctx.season === 'winter' && ctx.elapsed > 60,
      choices: [
        {
          id: 'secure-deal',
          label: 'Zabezpiecz dostawy (−12% cen przez 60 s)',
          apply: (api) => {
            api.setGlobalDiscount(12, 60, 'Zapas przed zimą');
            api.toast('❄️', 'Zapas przed zimą: −12% cen przez 60 sekund.');
          },
        },
        {
          id: 'save-now',
          label: 'Oszczędzaj teraz (+10 ViCoins, +0.02 smog/s na 20 s)',
          apply: (api) => {
            api.grantCoins(10, 'Szybkie oszczędności');
            api.toast('ViCoin', 'Otrzymano 10 ViCoins. Uwaga na krótkotrwałe emisje.');
            // Modelujemy krótkotrwały skok smogu jako impuls natychmiastowy
            api.addPollutionInstant(0.4, 'Krótkotrwałe emisje');
          },
        },
      ],
    },
    // Retrofit fair arc (two steps)
    {
      id: 'retrofit-fair-invite',
      title: 'Zaproszenie na targi modernizacji',
      text:
        'Otrzymujesz zaproszenie na lokalne targi modernizacji. Udział może przynieść korzyści.',
      once: true,
      arc: 'retrofit-fair',
      cooldownSec: 120,
      condition: (ctx) => (ctx.ecoRep ?? 0) >= 35 && ctx.elapsed > 50 && !(ctx.flags?.['fair_attended']),
      choices: [
        {
          id: 'attend',
          label: 'Weź udział (−5 smogu, ustaw flagę)',
          apply: (api) => {
            api.addPollutionInstant(-5, 'Dobre praktyki z targów');
            api.setFlag?.('fair_attended', true);
            api.toast('🎪', 'Wziąłeś udział w targach modernizacji.');
          },
        },
        {
          id: 'skip',
          label: 'Pomiń (+6 ViCoins)',
          apply: (api) => {
            api.grantCoins(6, 'Oszczędność czasu');
          },
        },
      ],
    },
    {
      id: 'retrofit-fair-followup',
      title: 'Follow‑up po targach',
      text:
        'Organizatorzy proponują wspólną kampanię informacyjną w Twojej okolicy.',
      once: true,
      arc: 'retrofit-fair',
      cooldownSec: 90,
      condition: (ctx) => ctx.elapsed > 80 && (ctx.flags?.['fair_attended'] === true),
      choices: [
        {
          id: 'campaign',
          label: 'Zróbmy to! (−8% cen przez 60 s)',
          apply: (api) => {
            api.setGlobalDiscount(8, 60, 'Kampania posprzedażowa');
            api.toast('📣', 'Kampania informacyjna ruszyła.');
          },
        },
        {
          id: 'later',
          label: 'Może później (+5 ViCoins)',
          apply: (api) => api.grantCoins(5, 'Priorytety'),
        },
      ],
    },
    {
      id: 'winter-audit-check',
      title: 'Kontrola zimowa',
      text:
        'Urząd sprawdza przygotowanie do mrozów. Porządek i czyste spalanie mogą przynieść drobny bonus, zaniedbania – reprymendę.',
      once: true,
      condition: (ctx) => ctx.season === 'winter' && ctx.elapsed > 90,
      choices: [
        {
          id: 'pass-audit',
          label: 'Przedstaw plan oszczędności (+12 ViCoins)',
          apply: (api) => {
            api.grantCoins(12, 'Pozytywny audyt');
            api.toast('📋', 'Pozytywny audyt zimowy: +12 ViCoins.');
          },
        },
        {
          id: 'skip-audit',
          label: 'Nie udzielaj informacji (−3 smogu teraz)',
          apply: (api) => {
            api.addPollutionInstant(-3, 'Czystsze praktyki');
            api.toast('🌿', 'Drobne uporządkowanie: −3 smogu.');
          },
        },
      ],
    },
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
            api.setGlobalDiscount(20, 120, 'Dotacja gminna');
            api.toast('🎯', 'Aktywowano dotację: −20% cen przez 2 minuty.');
            api.log('Dotacja aktywna', 'Ceny obniżone o 20% na ograniczony czas.', '🎯');
          },
        },
        {
          id: 'decline',
          label: 'Zrezygnuj (zachowaj niezależność)',
          apply: (api) => {
            api.grantCoins(10, 'Premia za niezależność');
            api.toast('ViCoin', 'Otrzymano 10 ViCoins za niezależność.');
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
            api.setGlobalDiscount(15, 90, 'Kampania OZE');
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
    {
      id: 'pellet-supply-crunch',
      title: 'Logistyka pelletu',
      text:
        'Sezonowy szczyt popytu winduje ceny pelletu i wydłuża dostawy. Dostawca proponuje rabat na inne modernizacje w zamian za długoterminową umowę.',
      once: true,
      condition: (ctx) => ctx.elapsed > 45 && (ctx.season === 'autumn' || ctx.season === 'winter') && !ctx.hasCoal,
      choices: [
        {
          id: 'deal',
          label: 'Podpisz umowę (−10% cen przez 60 s)',
          apply: (api) => {
            api.setGlobalDiscount(10, 60, 'Umowa z dostawcą');
            api.toast('📦', 'Umowa logistyczna: −10% cen przez 60 sekund.');
          },
        },
        {
          id: 'wait',
          label: 'Przeczekaj sezon (+8 ViCoins)',
          apply: (api) => {
            api.grantCoins(8, 'Oszczędności');
            api.toast('🕒', 'Zdecydowałeś się przeczekać – +8 ViCoins.');
          },
        },
      ],
    },
    {
      id: 'frost-warning',
      title: 'Ostrzeżenie o mrozie',
      text:
        'Synoptycy zapowiadają silny mróz. Możesz przygotować instalację teraz lub zaryzykować większe zużycie podczas ochłodzenia.',
      once: true,
      condition: (ctx) => ctx.elapsed > 75 && (ctx.season === 'autumn' || ctx.season === 'winter'),
      choices: [
        {
          id: 'prepare',
          label: 'Przegląd instalacji (−4 smogu)',
          apply: (api) => {
            api.addPollutionInstant(-4, 'Przegląd instalacji');
            api.toast('🧰', 'Przegląd ograniczył straty i emisje (−4).');
          },
        },
        {
          id: 'bulk-buy',
          label: 'Zakup materiałów (−12% cen przez 45 s)',
          apply: (api) => {
            api.setGlobalDiscount(12, 45, 'Zakupy przed mrozem');
            api.toast('❄️', 'Zapas przed mrozem: −12% cen przez 45 sekund.');
          },
        },
      ],
    },
    {
      id: 'tech-expo-audit',
      title: 'Audyt na targach Tech‑Expo',
      text:
        'Twoja instalacja została wyróżniona jako przykład modernizacji. Organizatorzy oferują grant badawczy lub kampanię promocyjną.',
      once: true,
  condition: (ctx) => ctx.elapsed > 110 && ctx.pollution <= 25 && ctx.renewablesUnlocked && (ctx.ecoRep ?? 0) >= 50,
      choices: [
        {
          id: 'grant',
          label: 'Grant badawczy (+15 ViCoins)',
          apply: (api) => {
            api.grantCoins(15, 'Grant badawczy');
            api.toast('🏅', 'Otrzymano grant: +15 ViCoins.');
          },
        },
        {
          id: 'promo-discount',
          label: 'Promocja marki (−18% cen przez 60 s)',
          apply: (api) => {
            api.setGlobalDiscount(18, 60, 'Promocja na Tech‑Expo');
            api.toast('📣', 'Promocja: −18% cen przez 60 sekund.');
          },
        },
      ],
    },
  ];
}
