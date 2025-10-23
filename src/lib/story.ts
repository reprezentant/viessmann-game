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
        title: 'aid-package.title',
        text: 'aid-package.text',
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
          label: 'aid-package.choices.aid-sun',
          apply: (api) => {
            api.grantResources?.({ sun: 12 });
            api.toast('☀️', 'aid-package.toasts.aid-sun');
            api.adjustFaction?.('suppliers', +3);
          },
        },
        {
          id: 'aid-water',
          label: 'aid-package.choices.aid-water',
          apply: (api) => {
            api.grantResources?.({ water: 12 });
            api.toast('💧', 'aid-package.toasts.aid-water');
          },
        },
        {
          id: 'aid-wind',
          label: 'aid-package.choices.aid-wind',
          apply: (api) => {
            api.grantResources?.({ wind: 12 });
            api.toast('🌬️', 'aid-package.toasts.aid-wind');
          },
        },
        {
          id: 'aid-coins',
          label: 'aid-package.choices.aid-coins',
          apply: (api) => {
            api.grantCoins(10, 'aid-package.toasts.aid-coins');
            api.toast('💰', 'aid-package.toasts.aid-coins');
          },
        },
      ],
    },
    // Community arc (multi-step, faction effects)
    {
      id: 'community-garden-proposal',
        title: 'community-garden-proposal.title',
        text: 'community-garden-proposal.text',
      once: true,
      arc: 'community',
      cooldownSec: 120,
      condition: (ctx) => (ctx.ecoRep ?? 0) >= 60 && (ctx.forests ?? 0) >= 2 && (ctx.flags?.['community_garden'] !== true),
      choices: [
        {
          id: 'support-garden',
          label: 'community-garden-proposal.choices.support-garden',
          apply: (api) => {
            api.addPollutionInstant(-4, 'community-garden-proposal');
            api.adjustFaction?.('community', +10);
            api.setFlag?.('community_garden', true);
            api.toast('🌿', 'community-garden-proposal.toasts.support-garden');
          },
        },
        {
          id: 'no-budget',
          label: 'community-garden-proposal.choices.no-budget',
          apply: (api) => {
            api.grantCoins(8, 'community-garden-proposal.toasts.no-budget');
            api.adjustFaction?.('community', -6);
            api.toast('💰', 'community-garden-proposal.toasts.no-budget');
          },
        },
      ],
    },
    // High eco reputation reward
    {
      id: 'eco-champion-award',
        title: 'eco-champion-award.title',
        text: 'eco-champion-award.text',
      once: true,
      condition: (ctx) => (ctx.ecoRep ?? 0) >= 75 && ctx.renewablesUnlocked && ctx.elapsed > 120,
      choices: [
        {
          id: 'award-promo',
          label: 'eco-champion-award.choices.award-promo',
          apply: (api) => {
            api.setGlobalDiscount(18, 75, 'eco-champion-award');
            api.toast('🌿', 'eco-champion-award.toasts.award-promo');
          },
        },
        {
          id: 'award-coins',
          label: 'eco-champion-award.choices.award-coins',
          apply: (api) => {
            api.grantCoins(20, 'eco-champion-award.toasts.award-coins');
            api.toast('💰', 'eco-champion-award.toasts.award-coins');
          },
        },
      ],
    },
    // Supplier relation (faction)
    {
      id: 'supplier-mou',
        title: 'supplier-mou.title',
        text: 'supplier-mou.text',
      once: true,
      arc: 'suppliers',
      cooldownSec: 90,
      condition: (ctx) => (ctx.ecoRep ?? 0) >= 45 && ctx.elapsed > 70 && (ctx.factions?.['suppliers'] ?? 0) >= -20,
      choices: [
        {
          id: 'sign',
          label: 'supplier-mou.choices.sign',
          apply: (api) => {
            api.setGlobalDiscount(10, 75, 'supplier-mou');
            api.adjustFaction?.('suppliers', +8);
            api.setFlag?.('supplier_mou', true);
            api.toast('📜', 'supplier-mou.toasts.sign');
          },
        },
        {
          id: 'decline',
          label: 'supplier-mou.choices.decline',
          apply: (api) => {
            api.grantCoins(10, 'supplier-mou.toasts.decline');
            api.adjustFaction?.('suppliers', -8);
            api.toast('⚖️', 'supplier-mou.toasts.decline');
          },
        },
      ],
    },
    // Follow-up obligation if MoU was signed
    {
      id: 'supplier-mou-commitment',
        title: 'supplier-mou-commitment.title',
        text: 'supplier-mou-commitment.text',
      once: true,
      arc: 'suppliers',
      cooldownSec: 120,
      condition: (ctx) => ctx.flags?.['supplier_mou'] === true && ctx.elapsed > 120,
      choices: [
        {
          id: 'commit-pay',
          label: 'supplier-mou-commitment.choices.commit-pay',
          apply: (api) => {
            api.grantCoins(-12, 'supplier-mou-commitment.toasts.commit-pay');
            api.adjustFaction?.('suppliers', +6);
            api.toast('🤝', 'supplier-mou-commitment.toasts.commit-pay');
          },
        },
        {
          id: 'commit-defer',
          label: 'supplier-mou-commitment.choices.commit-defer',
          apply: (api) => {
            api.adjustFaction?.('suppliers', -10);
            api.setGlobalDiscount(-8, 45, 'supplier-mou-commitment');
            api.toast('⏳', 'supplier-mou-commitment.toasts.commit-defer');
          },
        },
      ],
    },
    // Community backlash when opinion is low
    {
      id: 'community-protest',
        title: 'community-protest.title',
        text: 'community-protest.text',
      once: true,
      arc: 'community',
      cooldownSec: 120,
      condition: (ctx) => (ctx.factions?.['community'] ?? 0) <= -25 && ctx.elapsed > 90,
      choices: [
        {
          id: 'hold-consult',
          label: 'community-protest.choices.hold-consult',
          apply: (api) => {
            api.grantCoins(-8, 'community-protest.toasts.hold-consult');
            api.addPollutionInstant(-3, 'community-protest');
            api.adjustFaction?.('community', +8);
          },
        },
        {
          id: 'ignore',
          label: 'community-protest.choices.ignore',
          apply: (api) => {
            api.grantCoins(5, 'community-protest.toasts.ignore');
            api.addPollutionInstant(+6, 'community-protest');
            api.adjustFaction?.('community', -6);
          },
        },
      ],
    },
    // Press critique when ecoRep is low: temporary price malus
    {
      id: 'press-critique',
        title: 'press-critique.title',
        text: 'press-critique.text',
      once: true,
      cooldownSec: 90,
      condition: (ctx) => (ctx.ecoRep ?? 0) < 30 && ctx.elapsed > 80,
      choices: [
        {
          id: 'accept',
          label: 'press-critique.choices.accept',
          apply: (api) => {
            api.setGlobalDiscount(-8, 45, 'press-critique');
            api.toast('📰', 'press-critique.toasts.accept');
          },
        },
        {
          id: 'counter',
          label: 'press-critique.choices.counter',
          apply: (api) => {
            api.grantCoins(-10, 'press-critique.toasts.counter');
            api.addPollutionInstant(-4, 'press-critique');
          },
        },
      ],
    },
    // Supplier delays when relations are poor
    {
      id: 'supplier-delay',
        title: 'supplier-delay.title',
        text: 'supplier-delay.text',
      once: true,
      cooldownSec: 90,
      condition: (ctx) => (ctx.factions?.['suppliers'] ?? 0) < -20 && ctx.elapsed > 100,
      choices: [
        {
          id: 'pay-expedite',
          label: 'supplier-delay.choices.pay-expedite',
          apply: (api) => {
            api.grantCoins(-10, 'supplier-delay.toasts.pay-expedite');
          },
        },
        {
          id: 'wait-longer',
          label: 'supplier-delay.choices.wait-longer',
          apply: (api) => {
            // Modelujemy jako drobny, opóźniony rabat: ustawiamy krótki cooldown i rabat teraz,
            // bo nie mamy zegara do opóźniania – efekt: mała kompensacja po stratach czasu.
            api.setGlobalDiscount(6, 30, 'supplier-delay');
          },
        },
      ],
    },
    // Mid eco reputation cooperation
    {
      id: 'municipal-partnership',
        title: 'municipal-partnership.title',
        text: 'municipal-partnership.text',
      once: true,
      condition: (ctx) => (ctx.ecoRep ?? 0) >= 40 && (ctx.ecoRep ?? 0) < 75 && ctx.elapsed > 80,
      choices: [
        {
          id: 'education',
          label: 'municipal-partnership.choices.education',
          apply: (api) => {
            api.addPollutionInstant(-6, 'municipal-partnership');
            api.toast('📘', 'municipal-partnership.toasts.education');
          },
        },
        {
          id: 'cofund',
          label: 'municipal-partnership.choices.cofund',
          apply: (api) => {
            api.setGlobalDiscount(12, 60, 'municipal-partnership');
            api.toast('🤝', 'municipal-partnership.toasts.cofund');
          },
        },
      ],
    },
    // Low eco reputation corrective plan
    {
      id: 'compliance-plan',
        title: 'compliance-plan.title',
        text: 'compliance-plan.text',
      once: true,
      condition: (ctx) => (ctx.ecoRep ?? 0) < 30 && ctx.pollution >= 50 && ctx.elapsed > 70,
      choices: [
        {
          id: 'accept-plan',
          label: 'compliance-plan.choices.accept-plan',
          apply: (api) => {
            api.addPollutionInstant(-8, 'compliance-plan');
            api.setGlobalDiscount(8, 45, 'compliance-plan');
            api.toast('🧹', 'compliance-plan.toasts.accept-plan');
          },
        },
        {
          id: 'defer-actions',
          label: 'compliance-plan.choices.defer-actions',
          apply: (api) => {
            api.grantCoins(10, 'compliance-plan.toasts.defer-actions');
            api.addPollutionInstant(+3, 'compliance-plan');
            api.toast('⏳', 'compliance-plan.toasts.defer-actions');
          },
        },
      ],
    },
    {
      id: 'winter-prep-supplies',
        title: 'winter-prep-supplies.title',
        text: 'winter-prep-supplies.text',
      once: true,
      condition: (ctx) => ctx.season === 'winter' && ctx.elapsed > 60,
      choices: [
        {
          id: 'secure-deal',
          label: 'winter-prep-supplies.choices.secure-deal',
          apply: (api) => {
            api.setGlobalDiscount(12, 60, 'winter-prep-supplies');
            api.toast('❄️', 'winter-prep-supplies.toasts.secure-deal');
          },
        },
        {
          id: 'save-now',
          label: 'winter-prep-supplies.choices.save-now',
          apply: (api) => {
            api.grantCoins(10, 'winter-prep-supplies.toasts.save-now');
            api.toast('💰', 'winter-prep-supplies.toasts.save-now');
            // Modelujemy krótkotrwały skok smogu jako impuls natychmiastowy
            api.addPollutionInstant(0.4, 'winter-prep-supplies');
          },
        },
      ],
    },
    // Retrofit fair arc (two steps)
    {
      id: 'retrofit-fair-invite',
        title: 'retrofit-fair-invite.title',
        text: 'retrofit-fair-invite.text',
      once: true,
      arc: 'retrofit-fair',
      cooldownSec: 120,
      condition: (ctx) => (ctx.ecoRep ?? 0) >= 35 && ctx.elapsed > 50 && !(ctx.flags?.['fair_attended']),
      choices: [
        {
          id: 'attend',
          label: 'retrofit-fair-invite.choices.attend',
          apply: (api) => {
            api.addPollutionInstant(-5, 'retrofit-fair-invite');
            api.setFlag?.('fair_attended', true);
            api.toast('🎪', 'retrofit-fair-invite.toasts.attend');
          },
        },
        {
          id: 'skip',
          label: 'retrofit-fair-invite.choices.skip',
          apply: (api) => {
            api.grantCoins(6, 'retrofit-fair-invite.toasts.skip');
          },
        },
      ],
    },
    {
      id: 'retrofit-fair-followup',
        title: 'retrofit-fair-followup.title',
        text: 'retrofit-fair-followup.text',
      once: true,
      arc: 'retrofit-fair',
      cooldownSec: 90,
      condition: (ctx) => ctx.elapsed > 80 && (ctx.flags?.['fair_attended'] === true),
      choices: [
        {
          id: 'campaign',
          label: 'retrofit-fair-followup.choices.campaign',
          apply: (api) => {
            api.setGlobalDiscount(8, 60, 'retrofit-fair-followup');
            api.toast('📣', 'retrofit-fair-followup.toasts.campaign');
          },
        },
        {
          id: 'later',
          label: 'retrofit-fair-followup.choices.later',
          apply: (api) => api.grantCoins(5, 'retrofit-fair-followup.toasts.later'),
        },
      ],
    },
    {
      id: 'winter-audit-check',
        title: 'winter-audit-check.title',
        text: 'winter-audit-check.text',
      once: true,
      condition: (ctx) => ctx.season === 'winter' && ctx.elapsed > 90,
      choices: [
        {
          id: 'pass-audit',
          label: 'winter-audit-check.choices.pass-audit',
          apply: (api) => {
            api.grantCoins(12, 'winter-audit-check.toasts.pass-audit');
            api.toast('📋', 'winter-audit-check.toasts.pass-audit');
          },
        },
        {
          id: 'skip-audit',
          label: 'winter-audit-check.choices.skip-audit',
          apply: (api) => {
            api.addPollutionInstant(-3, 'winter-audit-check');
            api.toast('🌿', 'winter-audit-check.toasts.skip-audit');
          },
        },
      ],
    },
    {
      id: 'grant-boiler-exchange',
        title: 'grant-boiler-exchange.title',
        text: 'grant-boiler-exchange.text',
      once: true,
      condition: (ctx) => ctx.hasCoal && ctx.elapsed > 30,
      choices: [
        {
          id: 'accept',
          label: 'grant-boiler-exchange.choices.accept',
          apply: (api) => {
            api.setGlobalDiscount(20, 120, 'grant-boiler-exchange');
            api.toast('🎯', 'grant-boiler-exchange.toasts.accept');
            api.log('grant-boiler-exchange.toasts.accept', 'grant-boiler-exchange.toasts.accept', '🎯');
          },
        },
        {
          id: 'decline',
          label: 'grant-boiler-exchange.choices.decline',
          apply: (api) => {
            api.grantCoins(10, 'grant-boiler-exchange.toasts.decline');
            api.toast('💰', 'grant-boiler-exchange.toasts.decline');
          },
        },
      ],
    },
    {
      id: 'summer-solar-push',
      title: 'summer-solar-push.title',
      text: 'summer-solar-push.text',
      once: true,
      condition: (ctx) => ctx.renewablesUnlocked && ctx.season === 'summer' && ctx.elapsed > 60,
      choices: [
        {
          id: 'promo',
          label: 'summer-solar-push.choices.promo',
          apply: (api) => {
            api.setGlobalDiscount(15, 90, 'summer-solar-push');
            api.toast('☀️', 'summer-solar-push.toasts.promo');
          },
        },
        {
          id: 'awareness',
          label: 'summer-solar-push.choices.awareness',
          apply: (api) => {
            api.addPollutionInstant(-5, 'summer-solar-push');
            api.toast('🌿', 'summer-solar-push.toasts.awareness');
          },
        },
      ],
    },
    {
      id: 'pellet-supply-crunch',
      title: 'pellet-supply-crunch.title',
      text: 'pellet-supply-crunch.text',
      once: true,
      condition: (ctx) => ctx.elapsed > 45 && (ctx.season === 'autumn' || ctx.season === 'winter') && !ctx.hasCoal,
      choices: [
        {
          id: 'deal',
          label: 'pellet-supply-crunch.choices.deal',
          apply: (api) => {
            api.setGlobalDiscount(10, 60, 'pellet-supply-crunch');
            api.toast('📦', 'pellet-supply-crunch.toasts.deal');
          },
        },
        {
          id: 'wait',
          label: 'pellet-supply-crunch.choices.wait',
          apply: (api) => {
            api.grantCoins(8, 'pellet-supply-crunch.toasts.wait');
            api.toast('🕒', 'pellet-supply-crunch.toasts.wait');
          },
        },
      ],
    },
    {
      id: 'frost-warning',
      title: 'frost-warning.title',
      text: 'frost-warning.text',
      once: true,
      condition: (ctx) => ctx.elapsed > 75 && (ctx.season === 'autumn' || ctx.season === 'winter'),
      choices: [
        {
          id: 'prepare',
          label: 'frost-warning.choices.prepare',
          apply: (api) => {
            api.addPollutionInstant(-4, 'frost-warning');
            api.toast('🧰', 'frost-warning.toasts.prepare');
          },
        },
        {
          id: 'bulk-buy',
          label: 'frost-warning.choices.bulk-buy',
          apply: (api) => {
            api.setGlobalDiscount(12, 45, 'frost-warning');
            api.toast('❄️', 'frost-warning.toasts.bulk-buy');
          },
        },
      ],
    },
    {
      id: 'tech-expo-audit',
      title: 'tech-expo-audit.title',
      text: 'tech-expo-audit.text',
      once: true,
  condition: (ctx) => ctx.elapsed > 110 && ctx.pollution <= 25 && ctx.renewablesUnlocked && (ctx.ecoRep ?? 0) >= 50,
      choices: [
        {
          id: 'grant',
          label: 'tech-expo-audit.choices.grant',
          apply: (api) => {
            api.grantCoins(15, 'tech-expo-audit.toasts.grant');
            api.toast('🏅', 'tech-expo-audit.toasts.grant');
          },
        },
        {
          id: 'promo-discount',
          label: 'tech-expo-audit.choices.promo-discount',
          apply: (api) => {
            api.setGlobalDiscount(18, 60, 'tech-expo-audit');
            api.toast('📣', 'tech-expo-audit.toasts.promo-discount');
          },
        },
      ],
    },
  ];
}
