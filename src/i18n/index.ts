import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import ui_pl from '../locales/pl/ui.json';
import ui_en from '../locales/en/ui.json';
import items_pl from '../locales/pl/items.json';
import items_en from '../locales/en/items.json';
import missions_pl from '../locales/pl/missions.json';
import missions_en from '../locales/en/missions.json';
import achievements_pl from '../locales/pl/achievements.json';
import achievements_en from '../locales/en/achievements.json';
import story_pl from '../locales/pl/story.json';
import story_en from '../locales/en/story.json';

const resources = {
  pl: {
    ui: ui_pl,
    items: items_pl,
    missions: missions_pl,
    achievements: achievements_pl,
    story: story_pl,
  },
  en: {
    ui: ui_en,
    items: items_en,
    missions: missions_en,
    achievements: achievements_en,
    story: story_en,
  }
};

const defaultLang = (localStorage.getItem('vm_lang') || navigator.language.split('-')[0] || 'pl') as 'pl' | 'en';

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: defaultLang,
    fallbackLng: 'pl',
    interpolation: { escapeValue: false },
    defaultNS: 'ui',
    ns: ['ui','items','missions','achievements','story']
  });

export default i18n;
